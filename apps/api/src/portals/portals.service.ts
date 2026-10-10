import {
  SOURCE_IDS,
  SOURCE_LABELS,
  type PortalAccount,
  type PortalStatus,
  type SourceId,
} from '@job-finder/shared';
import { InvalidMagicLinkError, type JobSource, type PortalConnection } from '@job-finder/sources';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { BrowserContext } from 'playwright';
import {
  BrowserService,
  BrowserUnavailableError,
  type StorageState,
} from '../browser/browser.service.js';
import { SecretBox } from '../common/crypto/secret-box.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { portalAccounts } from '../database/schema.js';

/** Adaptadores de los portales disponibles. Los tests los reemplazan por sitios locales. */
export const JOB_SOURCES = Symbol('JOB_SOURCES');

export type JobSources = Partial<Record<SourceId, JobSource>>;

export const PORTAL_CONNECTIONS = Symbol('PORTAL_CONNECTIONS');

export type PortalConnections = Partial<Record<SourceId, PortalConnection>>;

type AccountRow = typeof portalAccounts.$inferSelect;
type AccountChanges = Partial<Omit<typeof portalAccounts.$inferInsert, 'userId' | 'source'>>;

/**
 * Cuentas de los usuarios en los portales de empleo. La sesión de cada portal (sus cookies) se
 * guarda cifrada y nunca sale de la API. Ver ADR 0012.
 */
@Injectable()
export class PortalsService {
  private readonly logger = new Logger(PortalsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(SecretBox) private readonly secretBox: SecretBox,
    @Inject(BrowserService) private readonly browser: BrowserService,
    @Inject(PORTAL_CONNECTIONS) private readonly connections: PortalConnections,
  ) {}

  list(userId: number): PortalAccount[] {
    const rows = this.db
      .select()
      .from(portalAccounts)
      .where(eq(portalAccounts.userId, userId))
      .all();
    return SOURCE_IDS.map((source) =>
      this.toAccount(
        source,
        rows.find((row) => row.source === source),
      ),
    );
  }

  setEnabled(userId: number, source: SourceId, enabled: boolean): PortalAccount {
    this.requireConnection(source);
    return this.toAccount(source, this.save(userId, source, { enabled }));
  }

  /**
   * Abre el enlace mágico en el navegador del servidor, comprueba que la sesión quedó iniciada y
   * la guarda cifrada. El enlace no se guarda ni se escribe en los logs.
   */
  async connectWithMagicLink(
    userId: number,
    source: SourceId,
    link: string,
  ): Promise<PortalAccount> {
    const connection = this.requireConnection(source);
    if (connection.kind !== 'magic-link') {
      throw new BadRequestException(`${SOURCE_LABELS[source]} no se conecta con enlace mágico`);
    }
    try {
      connection.assertMagicLink(link);
    } catch (error) {
      if (error instanceof InvalidMagicLinkError) throw new BadRequestException(error.message);
      throw error;
    }

    const session = await this.inBrowser({}, async (context) => {
      await connection.openMagicLink(context, link);
      return (await connection.isLoggedIn(context)) ? context.storageState() : null;
    });
    if (!session) {
      throw new BadRequestException(
        'El enlace no inició sesión: puede estar vencido o ya usado. Pide uno nuevo y vuelve a intentar.',
      );
    }

    const now = new Date();
    return this.toAccount(
      source,
      this.save(userId, source, {
        status: 'connected',
        sessionEnc: this.secretBox.encrypt(JSON.stringify(session)),
        connectedAt: now,
        checkedAt: now,
      }),
    );
  }

  /**
   * Comprueba que la sesión guardada sigue viva. Usarla también la renueva en el portal, así que
   * se vuelve a guardar con su nuevo vencimiento.
   */
  async check(userId: number, source: SourceId): Promise<PortalAccount> {
    const connection = this.requireConnection(source);
    const stored = this.getSession(userId, source);
    if (!stored) return this.toAccount(source, this.markExpired(userId, source));

    const renewed = await this.inBrowser({ storageState: stored }, async (context) =>
      (await connection.isLoggedIn(context)) ? context.storageState() : null,
    );
    if (!renewed) return this.toAccount(source, this.markExpired(userId, source));

    return this.toAccount(
      source,
      this.save(userId, source, {
        status: 'connected',
        sessionEnc: this.secretBox.encrypt(JSON.stringify(renewed)),
        checkedAt: new Date(),
      }),
    );
  }

  disconnect(userId: number, source: SourceId): PortalAccount {
    this.requireConnection(source);
    return this.toAccount(
      source,
      this.save(userId, source, {
        status: 'disconnected',
        sessionEnc: null,
        connectedAt: null,
        checkedAt: null,
      }),
    );
  }

  /** Revisa todas las cuentas conectadas y activas, de a una. Mantiene vivas las sesiones. */
  async checkAll(): Promise<void> {
    const rows = this.db
      .select({ userId: portalAccounts.userId, source: portalAccounts.source })
      .from(portalAccounts)
      .where(and(eq(portalAccounts.status, 'connected'), eq(portalAccounts.enabled, true)))
      .all();
    for (const { userId, source } of rows) {
      try {
        const account = await this.check(userId, source);
        if (account.status !== 'connected') {
          this.logger.warn(`La sesión de ${source} del usuario ${userId} venció`);
        }
      } catch (error) {
        this.logger.error(
          `No se pudo revisar ${source} del usuario ${userId}: ${(error as Error).message}`,
        );
      }
    }
  }

  /** Sesión descifrada de un portal, para los adaptadores. `null` si no hay o no se puede leer. */
  getSession(userId: number, source: SourceId): StorageState | null {
    const row = this.findRow(userId, source);
    if (!row?.sessionEnc || row.status !== 'connected') return null;
    try {
      return JSON.parse(this.secretBox.decrypt(row.sessionEnc)) as StorageState;
    } catch {
      // Pasa si cambió APP_SECRET: hay que volver a conectar.
      this.logger.warn(`No se pudo leer la sesión de ${source} del usuario ${userId}`);
      return null;
    }
  }

  /**
   * Guarda la sesión tal como quedó después de usarla: el portal renueva su vencimiento con cada
   * uso, así que cada búsqueda la mantiene viva.
   */
  renewSession(userId: number, source: SourceId, session: StorageState): void {
    // Si el usuario desconectó el portal mientras se leía, no se vuelve a conectar por su cuenta.
    if (this.findRow(userId, source)?.status !== 'connected') return;
    this.save(userId, source, {
      status: 'connected',
      sessionEnc: this.secretBox.encrypt(JSON.stringify(session)),
      checkedAt: new Date(),
    });
  }

  /** El portal dejó de reconocer la sesión: se borra y el usuario tiene que reconectar. */
  markExpired(userId: number, source: SourceId): AccountRow {
    return this.save(userId, source, {
      status: 'expired',
      sessionEnc: null,
      checkedAt: new Date(),
    });
  }

  private async inBrowser<T>(
    options: { storageState?: StorageState },
    task: (context: BrowserContext) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.browser.withContext(options, task);
    } catch (error) {
      if (error instanceof BrowserUnavailableError) {
        throw new ServiceUnavailableException('El navegador del servidor no está disponible');
      }
      throw error;
    }
  }

  private requireConnection(source: SourceId): PortalConnection {
    const connection = this.connections[source];
    if (!connection) {
      throw new NotFoundException(`${SOURCE_LABELS[source]} todavía no está disponible`);
    }
    return connection;
  }

  private findRow(userId: number, source: SourceId): AccountRow | undefined {
    return this.db
      .select()
      .from(portalAccounts)
      .where(and(eq(portalAccounts.userId, userId), eq(portalAccounts.source, source)))
      .get();
  }

  private save(userId: number, source: SourceId, changes: AccountChanges): AccountRow {
    return this.db
      .insert(portalAccounts)
      .values({ userId, source, ...changes })
      .onConflictDoUpdate({ target: [portalAccounts.userId, portalAccounts.source], set: changes })
      .returning()
      .get();
  }

  private toAccount(source: SourceId, row: AccountRow | undefined): PortalAccount {
    const connection = this.connections[source];
    const status: PortalStatus = row?.status ?? 'disconnected';
    return {
      source,
      name: SOURCE_LABELS[source],
      available: Boolean(connection),
      connectionKind: connection?.kind ?? null,
      loginUrl: connection?.loginUrl ?? null,
      enabled: row?.enabled ?? true,
      status,
      connectedAt: row?.connectedAt?.toISOString() ?? null,
      checkedAt: row?.checkedAt?.toISOString() ?? null,
    };
  }
}
