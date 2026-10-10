import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { PortalsModule } from '../portals/portals.module.js';
import { RunArtifactsService } from './run-artifacts.service.js';
import { SearchRunnerService } from './search-runner.service.js';
import { SearchesController } from './searches.controller.js';
import { SearchesScheduler } from './searches.scheduler.js';
import { SearchesService } from './searches.service.js';

@Module({
  imports: [PortalsModule, JobsModule],
  controllers: [SearchesController],
  providers: [SearchesService, SearchRunnerService, SearchesScheduler, RunArtifactsService],
})
export class SearchesModule {}
