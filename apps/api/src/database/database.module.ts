import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Sqlite from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Env } from '../config/env.js';
import * as schema from './schema.js';

export const DATABASE = Symbol('DATABASE');

export type Database = BetterSQLite3Database<typeof schema> & { $client: Sqlite.Database };

// Igual desde src/ (tests) que desde dist/ (build): apps/api/drizzle
const MIGRATIONS_FOLDER = join(import.meta.dirname, '../../drizzle');

function createDatabase(path: string): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Sqlite(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createDatabase(config.get('DATABASE_PATH', { infer: true })),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  onApplicationShutdown(): void {
    this.db.$client.close();
  }
}
