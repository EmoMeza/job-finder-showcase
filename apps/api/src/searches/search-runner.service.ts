import { SOURCE_LABELS, type RunTrigger, type SearchRun, type SourceId } from '@job-finder/shared';
import {
  PortalChangedError,
  SessionExpiredError,
  type JobSource,
  type SourceContext,
} from '@job-finder/sources';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNotNull } from 'drizzle-orm';
import {
  BrowserService,
  BrowserUnavailableError,
  type StorageState,
} from '../browser/browser.service.js';
import type { Env } from '../config/env.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { portalAccounts, searches, searchRuns } from '../database/schema.js';
import { JobsService } from '../jobs/jobs.service.js';
import { PortalsService } from '../portals/portals.service.js';
import { RunArtifactsService } from './run-artifacts.service.js';
import { SearchesService, toRun, type RunRow, type SearchRow } from './searches.service.js';

/** Si varias páginas de oferta fallan seguidas, el problema no es de una oferta: se deja de insistir. */
const MAX_DETAIL_FAILURES_IN_A_ROW = 3;
const HOUR_MS = 60 * 60 * 1000;

type RunChanges = Partial<Omit<typeof searchRuns.$inferInsert, 'id' | 'searchId'>>;

/**
 * Ejecuta las búsquedas: abre el portal con la sesión del usuario, guarda las ofertas que
 * entrega el adaptador y deja registrado cómo le fue.
 *
 * Una búsqueda toma desde segundos hasta un par de minutos, así que corre en segundo plano: quien
 * la pide recibe la ejecución "en curso" y consulta su avance.
 */
@Injectable()
export class SearchRunnerService implements OnModuleInit {
  private readonly logger = new Logger(SearchRunnerService.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(BrowserService) private readonly browser: BrowserService,
    @Inject(PortalsService) private readonly portals: PortalsService,
    @Inject(SearchesService) private readonly portalSearches: SearchesService,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(RunArtifactsService) private readonly artifacts: RunArtifactsService,
  ) {}

  /** Una ejecución que quedó "en curso" es de un proceso anterior que ya no existe. */
  onModuleInit(): void {
    this.db
      .update(searchRuns)
      .set({
        status: 'failed',
        step: null,
        finishedAt: new Date(),
        error: 'La aplicación se reinició mientras la búsqueda estaba en curso.',
      })
      .where(eq(searchRuns.status, 'running'))
      .run();
  }

  /** Deja la búsqueda corriendo y devuelve su ejecución, todavía en curso. */
  start(userId: number, source: SourceId, trigger: RunTrigger): SearchRun {
    const adapter = this.portalSearches.requireSource(source);
    const session = this.portals.getSession(userId, source);
    if (!session) {
      throw new BadRequestException(
        `Conecta tu cuenta de ${SOURCE_LABELS[source]} en Configuración antes de buscar.`,
      );
    }
    const search = this.portalSearches.ensure(userId, source);
    const running = this.db
      .select({ id: searchRuns.id })
      .from(searchRuns)
      .where(and(eq(searchRuns.searchId, search.id), eq(searchRuns.status, 'running')))
      .get();
    if (running) {
      throw new ConflictException(`Ya hay una búsqueda en curso en ${SOURCE_LABELS[source]}.`);
    }

    const run = this.db
      .insert(searchRuns)
      .values({ searchId: search.id, trigger, step: 'Esperando al navegador' })
      .returning()
      .get();
    this.db
      .update(searches)
      .set({ lastRunAt: run.startedAt })
      .where(eq(searches.id, search.id))
      .run();

    const execution = this.execute(run, search, adapter, session)
      // Lo que falle aquí (por ejemplo, la base cerrada al apagar) no debe botar el proceso.
      .catch((error: unknown) => this.logger.error(`Ejecución ${run.id}: ${String(error)}`))
      .finally(() => this.inFlight.delete(execution));
    this.inFlight.add(execution);
    return toRun(run);
  }

  /** Lanza las búsquedas automáticas a las que ya les toca. */
  runDue(now = new Date()): void {
    const candidates = this.db
      .select({ search: searches })
      .from(searches)
      .innerJoin(
        portalAccounts,
        and(eq(portalAccounts.userId, searches.userId), eq(portalAccounts.source, searches.source)),
      )
      .where(
        and(
          isNotNull(searches.intervalHours),
          eq(portalAccounts.status, 'connected'),
          eq(portalAccounts.enabled, true),
        ),
      )
      .all();
    for (const { search } of candidates) {
      const nextRunAt = (search.lastRunAt?.getTime() ?? 0) + (search.intervalHours ?? 0) * HOUR_MS;
      if (nextRunAt > now.getTime()) continue;
      try {
        this.start(search.userId, search.source, 'scheduled');
      } catch (error) {
        this.logger.warn(
          `No se lanzó la búsqueda de ${search.source} del usuario ${search.userId}: ${(error as Error).message}`,
        );
      }
    }
  }

  /** Espera a que terminen las ejecuciones en curso. Lo usan los tests. */
  async whenIdle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.all(this.inFlight);
  }

  private async execute(
    run: RunRow,
    search: SearchRow,
    adapter: JobSource,
    session: StorageState,
  ): Promise<void> {
    const { userId, source } = search;
    const saved: string[] = [];
    const logger = new Logger(`Búsqueda ${run.id} (${source})`);
    void this.artifacts.prune().catch(() => {});

    try {
      const outcome = await this.browser.withContext({ storageState: session }, async (context) => {
        const ctx: SourceContext = {
          browser: context,
          throttle: () => this.pause(),
          logger: {
            debug: (message) => logger.debug(message),
            info: (message) => logger.log(message),
            warn: (message) => logger.warn(message),
            error: (message) => logger.error(message),
          },
          saveArtifact: async (name, content) => {
            const file = await this.artifacts.save(run.id, name, content);
            if (file) saved.push(file);
          },
        };

        this.update(run.id, { step: 'Leyendo las ofertas' });
        const result = await adapter.search(ctx, {
          maxListings: this.config.get('SEARCH_MAX_LISTINGS', { infer: true }),
        });
        const { added } = this.jobs.saveListings(userId, search.id, source, result.listings);
        this.update(run.id, { found: result.listings.length, added });

        const warnings = [...result.warnings];
        const pending = this.jobs.pendingDetails(
          source,
          result.listings.map((listing) => listing.externalId),
          this.config.get('SEARCH_MAX_DETAILS', { infer: true }),
        );
        let failed = 0;
        let failedInARow = 0;
        for (const [index, job] of pending.entries()) {
          if (failedInARow >= MAX_DETAIL_FAILURES_IN_A_ROW) break;
          this.update(run.id, {
            step: `Leyendo el detalle de las ofertas (${index + 1} de ${pending.length})`,
          });
          await ctx.throttle();
          try {
            this.jobs.saveDetail(job.id, await adapter.getDetail(ctx, job));
            failedInARow = 0;
          } catch (error) {
            failed += 1;
            failedInARow += 1;
            logger.warn(`No se pudo leer ${job.url}: ${(error as Error).message}`);
          }
        }
        if (failed > 0) {
          warnings.push(
            `No se pudo leer el detalle de ${failed === 1 ? 'una oferta' : `${failed} ofertas`}. ` +
              'Se intentará de nuevo en la próxima búsqueda.',
          );
        }

        // Usar la sesión la renueva en el portal: se guarda con su nuevo vencimiento.
        this.portals.renewSession(userId, source, await context.storageState());
        return { result, warnings };
      });

      const finishedAt = new Date();
      this.update(run.id, {
        status: 'success',
        step: null,
        finishedAt,
        reachedEnd: outcome.result.reachedEnd,
        warnings: outcome.warnings,
        artifacts: saved,
      });
      this.db
        .update(searches)
        .set({ conditions: outcome.result.conditions, conditionsReadAt: finishedAt })
        .where(eq(searches.id, search.id))
        .run();
    } catch (error) {
      if (error instanceof SessionExpiredError) this.portals.markExpired(userId, source);
      // Una sesión vencida o un cambio del portal son fallas esperables; el resto, no.
      if (error instanceof SessionExpiredError || error instanceof PortalChangedError) {
        logger.warn(String(error));
      } else {
        logger.error(String(error));
      }
      this.update(run.id, {
        status: 'failed',
        step: null,
        finishedAt: new Date(),
        error: describeFailure(error, source),
        artifacts: saved,
      });
    }
  }

  private update(runId: number, changes: RunChanges): void {
    this.db.update(searchRuns).set(changes).where(eq(searchRuns.id, runId)).run();
  }

  /** Entre la pausa mínima y su triple, para no leer el portal con un ritmo fijo. */
  private pause(): Promise<void> {
    const base = this.config.get('PORTAL_PAUSE_MS', { infer: true });
    if (base === 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, base + Math.random() * base * 2));
  }
}

/** El error en palabras para quien usa la app; el detalle técnico queda en el log. */
function describeFailure(error: unknown, source: SourceId): string {
  if (error instanceof SessionExpiredError) {
    return `La sesión de ${SOURCE_LABELS[source]} venció. Vuelve a conectar tu cuenta en Configuración.`;
  }
  if (error instanceof PortalChangedError) return error.message;
  if (error instanceof BrowserUnavailableError) {
    return 'El navegador del servidor no está disponible.';
  }
  const detail = (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';
  return `La búsqueda se interrumpió por un error inesperado: ${detail.slice(0, 300)}`;
}
