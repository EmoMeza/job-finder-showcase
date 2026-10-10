import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SearchRunnerService } from './search-runner.service.js';

/** Revisa cada 10 minutos si a alguna búsqueda automática ya le toca correr. */
@Injectable()
export class SearchesScheduler {
  constructor(@Inject(SearchRunnerService) private readonly runner: SearchRunnerService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  runDueSearches(): void {
    this.runner.runDue();
  }
}
