import { createHash, randomBytes } from 'node:crypto';
import type { SessionUser } from '@job-finder/shared';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { sessions, users } from '../database/schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/**
 * Sesiones guardadas en la base de datos (ver ADR 0009). La cookie lleva un token aleatorio y
 * la base de datos solo guarda su hash.
 */
@Injectable()
export class SessionsService {
  private readonly ttlMs: number;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('SESSION_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  create(userId: number): CreatedSession {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    this.db
      .insert(sessions)
      .values({ id: hashToken(token), userId, expiresAt })
      .run();
    return { token, expiresAt };
  }

  /**
   * Devuelve el usuario de una sesión vigente. Si a la sesión le queda menos de la mitad de su
   * duración, la extiende (expiración deslizante) y devuelve la nueva fecha.
   */
  validate(token: string): { user: SessionUser; renewedUntil: Date | null } | null {
    const now = new Date();
    const row = this.db
      .select({
        id: sessions.id,
        expiresAt: sessions.expiresAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          llmProvider: users.llmProvider,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, now)))
      .get();
    if (!row) return null;

    let renewedUntil: Date | null = null;
    if (row.expiresAt.getTime() - now.getTime() < this.ttlMs / 2) {
      renewedUntil = new Date(now.getTime() + this.ttlMs);
      this.db
        .update(sessions)
        .set({ expiresAt: renewedUntil })
        .where(eq(sessions.id, row.id))
        .run();
    }
    return { user: row.user, renewedUntil };
  }

  revoke(token: string): void {
    this.db
      .delete(sessions)
      .where(eq(sessions.id, hashToken(token)))
      .run();
  }

  revokeAllForUser(userId: number): void {
    this.db.delete(sessions).where(eq(sessions.userId, userId)).run();
  }

  /** Borra las sesiones vencidas. Devuelve cuántas se eliminaron. */
  deleteExpired(): number {
    return this.db.delete(sessions).where(lte(sessions.expiresAt, new Date())).run().changes;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
