import type { HealthResponse } from '@job-finder/shared';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/public.decorator.js';
import { DATABASE, type Database } from '../database/database.module.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  check(): HealthResponse {
    try {
      this.db.get(sql`select 1`);
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'error' });
    }
  }
}
