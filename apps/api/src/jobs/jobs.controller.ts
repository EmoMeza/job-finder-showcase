import type { JobSummary, SessionUser } from '@job-finder/shared';
import { Controller, Get, Inject } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JobsService } from './jobs.service.js';

/** Ofertas encontradas por las búsquedas del usuario de la sesión. */
@Controller('jobs')
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  /** GET /api/jobs */
  @Get()
  list(@CurrentUser() user: SessionUser): JobSummary[] {
    return this.jobs.listForUser(user.id);
  }
}
