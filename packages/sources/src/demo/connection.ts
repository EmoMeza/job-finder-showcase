import type { BrowserContext } from 'playwright';
import { InvalidMagicLinkError, type PortalConnection } from '../connection.js';

/** Dónde corre el portal de demostración si no se indica otra cosa. */
export const DEMO_PORTAL_ORIGIN = 'http://localhost:4100';

const LOGIN_PATH = '/ingresar';
const MAGIC_LINK_PATH = '/ingresar/enlace';
/** Solo visible con sesión: sin ella el portal redirige a la portada. */
const PRIVATE_PATH = '/postulaciones';

/** Pausa corta entre acciones, como una persona. */
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Valida que el enlace sea un enlace de ingreso del portal antes de abrirlo en el navegador del
 * servidor: mismo origen y solo la ruta de ingreso. Así el navegador no se puede usar para abrir
 * cualquier dirección.
 */
export function parseDemoMagicLink(link: string, origin = DEMO_PORTAL_ORIGIN): URL {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    throw new InvalidMagicLinkError('Eso no parece un enlace. Copia la dirección completa.');
  }
  if (url.origin !== new URL(origin).origin || url.username || url.password) {
    throw new InvalidMagicLinkError('El enlace no es de este portal.');
  }
  if (url.pathname !== MAGIC_LINK_PATH || !url.searchParams.has('token')) {
    throw new InvalidMagicLinkError('No es un enlace de ingreso. Usa el que te entrega el portal.');
  }
  return url;
}

/**
 * Conexión por enlace mágico (ver docs/portal-demo.md):
 * - el usuario pide el enlace en su propio navegador y lo pega en la app;
 * - el enlace lleva a una página que pide confirmar con "Ingresar";
 * - con sesión, la página privada carga; sin sesión, redirige a la portada.
 */
export function createDemoConnection(origin = DEMO_PORTAL_ORIGIN): PortalConnection {
  return {
    source: 'demo',
    kind: 'magic-link',
    loginUrl: `${origin}${LOGIN_PATH}`,

    assertMagicLink(link: string): void {
      parseDemoMagicLink(link, origin);
    },

    async openMagicLink(context: BrowserContext, link: string): Promise<void> {
      const url = parseDemoMagicLink(link, origin);
      const page = await context.newPage();
      try {
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
        await pause(300);
        const confirm = page
          .getByRole('button', { name: 'Ingresar', exact: true })
          .or(page.getByRole('link', { name: 'Ingresar', exact: true }));
        if (
          await confirm
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          await confirm.first().click();
          await page.waitForLoadState('domcontentloaded');
          await pause(300);
        }
      } finally {
        await page.close();
      }
    },

    async isLoggedIn(context: BrowserContext): Promise<boolean> {
      const page = await context.newPage();
      try {
        await page.goto(`${origin}${PRIVATE_PATH}`, { waitUntil: 'domcontentloaded' });
        await pause(200);
        const onPrivatePage = new URL(page.url()).pathname.startsWith(PRIVATE_PATH);
        const loginLinks = await page.locator(`a[href*="${LOGIN_PATH}"]`).count();
        return onPrivatePage && loginLinks === 0;
      } finally {
        await page.close();
      }
    },
  };
}
