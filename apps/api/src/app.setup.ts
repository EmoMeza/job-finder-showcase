import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Proxies en los que se confía para leer la IP real del cliente desde `X-Forwarded-For`:
 * el reverse proxy del servidor y el nginx del contenedor web llegan desde direcciones
 * privadas (red de Docker). Una IP pública en la cadena nunca se toma como proxy, así que un
 * cliente no puede falsificar su IP agregando la cabecera.
 */
const TRUSTED_PROXIES = 'loopback, linklocal, uniquelocal';

/** Configuración compartida entre `main.ts` y los tests e2e. */
export function configureApp(app: NestExpressApplication): void {
  app.set('trust proxy', TRUSTED_PROXIES);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableShutdownHooks();
}
