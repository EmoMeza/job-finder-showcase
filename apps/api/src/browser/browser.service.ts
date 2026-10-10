import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { chromium, type Browser, type BrowserContext } from 'playwright';

export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/** Tiempo sin uso tras el cual se cierra el navegador para liberar memoria. */
const IDLE_CLOSE_MS = 60_000;

/**
 * Navegador del servidor (Chromium sin ventana) para leer los portales con la sesión del usuario.
 *
 * Pensado para un servidor chico: se abre recién cuando se necesita, atiende una tarea a la vez y
 * se cierra solo después de un minuto sin uso. Cada tarea corre en un contexto nuevo y aislado
 * (como una ventana de incógnito), que se descarta al terminar.
 */
@Injectable()
export class BrowserService implements OnApplicationShutdown {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Promise<Browser> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private idleTimer: NodeJS.Timeout | undefined;

  withContext<T>(
    options: { storageState?: StorageState },
    task: (context: BrowserContext) => Promise<T>,
  ): Promise<T> {
    const run = this.queue.then(async () => {
      clearTimeout(this.idleTimer);
      const browser = await this.launch();
      const context = await browser.newContext({
        locale: 'es-CL',
        viewport: { width: 1366, height: 900 },
        storageState: options.storageState,
      });
      try {
        return await task(context);
      } finally {
        await context.close().catch(() => {});
        this.idleTimer = setTimeout(() => void this.close(), IDLE_CLOSE_MS);
        this.idleTimer.unref();
      }
    });
    // La cola sigue aunque una tarea falle.
    this.queue = run.catch(() => {});
    return run;
  }

  async onApplicationShutdown(): Promise<void> {
    clearTimeout(this.idleTimer);
    await this.close();
  }

  private launch(): Promise<Browser> {
    this.browser ??= chromium.launch({ headless: true }).catch((error: unknown) => {
      this.browser = null;
      this.logger.error(`No se pudo abrir Chromium: ${(error as Error).message.split('\n')[0]}`);
      throw new BrowserUnavailableError();
    });
    return this.browser;
  }

  private async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    if (browser) await browser.then((instance) => instance.close()).catch(() => {});
  }
}

export class BrowserUnavailableError extends Error {
  constructor() {
    super('El navegador del servidor no está disponible');
    this.name = 'BrowserUnavailableError';
  }
}
