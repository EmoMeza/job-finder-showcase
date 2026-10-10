import { createDemoSource, DEMO_PORTAL_ORIGIN } from '@job-finder/sources';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PortalsController } from './portals.controller.js';
import { PortalsScheduler } from './portals.scheduler.js';
import {
  JOB_SOURCES,
  PORTAL_CONNECTIONS,
  PortalsService,
  type JobSources,
  type PortalConnections,
} from './portals.service.js';

@Module({
  controllers: [PortalsController],
  providers: [
    PortalsService,
    PortalsScheduler,
    {
      // Portales con adaptador. El de demostración corre junto con la API (ver DemoPortalModule).
      provide: JOB_SOURCES,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): JobSources => {
        const port = config.get('DEMO_PORTAL_PORT', { infer: true });
        return {
          demo: createDemoSource(port === 0 ? DEMO_PORTAL_ORIGIN : `http://localhost:${port}`),
        };
      },
    },
    {
      // La conexión de cada portal la declara su adaptador.
      provide: PORTAL_CONNECTIONS,
      inject: [JOB_SOURCES],
      useFactory: (sources: JobSources): PortalConnections =>
        Object.fromEntries(Object.entries(sources).map(([id, source]) => [id, source.connection])),
    },
  ],
  exports: [PortalsService, JOB_SOURCES],
})
export class PortalsModule {}
