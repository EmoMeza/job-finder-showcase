import { startDemoPortal } from '@job-finder/sources';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/**
 * Levanta el portal de empleo ficticio junto con la API, para que la demostración funcione de
 * punta a punta sin depender de ningún sitio externo. Ver docs/portal-demo.md.
 */
@Injectable()
export class DemoPortalService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DemoPortalService.name);
  private portal: Awaited<ReturnType<typeof startDemoPortal>> | undefined;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {}

  async onModuleInit(): Promise<void> {
    const port = this.config.get('DEMO_PORTAL_PORT', { infer: true });
    if (port === 0) return;
    try {
      this.portal = await startDemoPortal({
        port,
        host: this.config.get('DEMO_PORTAL_HOST', { infer: true }),
      });
      this.logger.log(`Portal de demostración en ${this.portal.origin}`);
    } catch (error) {
      // Sin el portal la app igual sirve; solo no hay dónde conectar una cuenta.
      this.logger.warn(
        `No se pudo levantar el portal de demostración: ${(error as Error).message}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.portal?.close();
  }
}
