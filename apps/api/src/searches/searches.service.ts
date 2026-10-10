import {
  SOURCE_IDS,
  SOURCE_LABELS,
  type PortalSearch,
  type SearchIntervalHours,
  type SearchRun,
  type SourceId,
} from '@job-finder/shared';
import type { JobSource } from '@job-finder/sources';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { searches, searchRuns } from '../database/schema.js';
import { JOB_SOURCES, PortalsService, type JobSources } from '../portals/portals.service.js';

const RUNS_SHOWN = 20;

export type SearchRow = typeof searches.$inferSelect;
export type RunRow = typeof searchRuns.$inferSelect;

/** La búsqueda de cada usuario en cada portal: sus condiciones, su frecuencia y su historial. */
@Injectable()
export class SearchesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(PortalsService) private readonly portals: PortalsService,
    @Inject(JOB_SOURCES) private readonly sources: JobSources,
  ) {}

  /** Una búsqueda por cada portal que ya tiene adaptador, esté o no conectado. */
  list(userId: number): PortalSearch[] {
    const accounts = this.portals.list(userId);
    return SOURCE_IDS.filter((source) => this.sources[source]).map((source) => {
      const adapter = this.requireSource(source);
      const account = accounts.find((item) => item.source === source);
      const search = this.find(userId, source);
      const lastRun = search ? this.latestRuns(search.id, 1)[0] : undefined;
      const { conditions } = adapter;
      return {
        source,
        name: SOURCE_LABELS[source],
        portalStatus: account?.status ?? 'disconnected',
        enabled: account?.enabled ?? true,
        conditionsManagedIn: conditions.managedIn,
        conditionsUrl: conditions.managedIn === 'portal' ? conditions.url : null,
        conditions: search?.conditions ?? null,
        conditionsReadAt: search?.conditionsReadAt?.toISOString() ?? null,
        intervalHours: (search?.intervalHours as SearchIntervalHours | null | undefined) ?? null,
        lastRun: lastRun ? toRun(lastRun) : null,
      };
    });
  }

  setInterval(
    userId: number,
    source: SourceId,
    intervalHours: SearchIntervalHours | null,
  ): PortalSearch {
    const search = this.ensure(userId, source);
    this.db.update(searches).set({ intervalHours }).where(eq(searches.id, search.id)).run();
    return this.list(userId).find((item) => item.source === source)!;
  }

  /** Últimas ejecuciones, de la más reciente a la más antigua. */
  runs(userId: number, source: SourceId): SearchRun[] {
    this.requireSource(source);
    const search = this.find(userId, source);
    return search ? this.latestRuns(search.id, RUNS_SHOWN).map(toRun) : [];
  }

  /** Una ejecución, solo si es de una búsqueda del usuario. */
  findRun(userId: number, runId: number): RunRow | undefined {
    return this.db
      .select({ run: searchRuns })
      .from(searchRuns)
      .innerJoin(searches, eq(searches.id, searchRuns.searchId))
      .where(and(eq(searchRuns.id, runId), eq(searches.userId, userId)))
      .get()?.run;
  }

  /** La búsqueda del usuario en el portal; se crea la primera vez que hace falta. */
  ensure(userId: number, source: SourceId): SearchRow {
    this.requireSource(source);
    this.db.insert(searches).values({ userId, source }).onConflictDoNothing().run();
    return this.find(userId, source)!;
  }

  requireSource(source: SourceId): JobSource {
    const adapter = this.sources[source];
    if (!adapter) {
      throw new NotFoundException(`${SOURCE_LABELS[source]} todavía no está disponible`);
    }
    return adapter;
  }

  private find(userId: number, source: SourceId): SearchRow | undefined {
    return this.db
      .select()
      .from(searches)
      .where(and(eq(searches.userId, userId), eq(searches.source, source)))
      .get();
  }

  private latestRuns(searchId: number, limit: number): RunRow[] {
    return this.db
      .select()
      .from(searchRuns)
      .where(eq(searchRuns.searchId, searchId))
      .orderBy(desc(searchRuns.id))
      .limit(limit)
      .all();
  }
}

export function toRun(row: RunRow): SearchRun {
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    step: row.status === 'running' ? row.step : null,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    found: row.found,
    added: row.added,
    reachedEnd: row.reachedEnd,
    warnings: row.warnings,
    error: row.error,
    artifacts: row.artifacts,
  };
}
