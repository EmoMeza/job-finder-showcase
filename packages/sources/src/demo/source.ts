import { isDeepStrictEqual } from 'node:util';
import type { Page, Request } from 'playwright';
import { PortalChangedError, SessionExpiredError } from '../errors.js';
import type { JobListing, JobSource, SearchResult, SourceContext } from '../types.js';
import { createDemoConnection, DEMO_PORTAL_ORIGIN } from './connection.js';
import { readJobDetail } from './detail.js';
import {
  describePreferences,
  parseFeedPage,
  parseTaxonomyList,
  type PortalPreferences,
  type PortalTaxonomy,
} from './feed.js';

const FEED_PATH = '/para-ti';
const FEED_JSON_PATH = '/para-ti.json';
const MORE_OFFERS_PATH = '/ofertas/mas.json';
const DEFAULT_MAX_LISTINGS = 100;
const RESPONSE_TIMEOUT_MS = 30_000;
const RENDER_TIMEOUT_MS = 5_000;
const CARD_SELECTOR = '#resultados a.oferta';

/**
 * Adaptador del portal de demostración. Ver docs/portal-demo.md y el ADR 0013.
 *
 * Lee el feed "Para ti" con las condiciones que el usuario tiene guardadas en su cuenta, usando
 * solo lo que hace la propia página:
 * - la primera tanda es la consulta de lectura que la página hace al cargar, que además trae las
 *   preferencias guardadas;
 * - las siguientes se piden con su botón "Cargar más ofertas".
 *
 * Esa segunda consulta **guarda como preferencias los filtros que recibe**. Por eso el adaptador
 * nunca la arma: deja que la envíe la página y la intercepta para dejarla pasar solo si lleva,
 * sin cambios, las preferencias que ya estaban guardadas.
 */
export function createDemoSource(origin = DEMO_PORTAL_ORIGIN): JobSource {
  return {
    id: 'demo',
    connection: createDemoConnection(origin),
    conditions: { managedIn: 'portal', url: `${origin}${FEED_PATH}` },

    async search(ctx, options = {}): Promise<SearchResult> {
      const maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
      const page = await ctx.browser.newPage();
      try {
        // Lo que la cuenta tiene guardado; hasta conocerlo no sale ninguna consulta de búsqueda.
        let saved: PortalPreferences | null = null;
        let blocked = false;
        await page.route(isPath(MORE_OFFERS_PATH), async (route) => {
          const sent = sentPreferences(route.request());
          if (saved !== null && sent !== null && isDeepStrictEqual(sent, saved)) {
            await route.continue();
          } else {
            blocked = true;
            await route.abort('blockedbyclient');
          }
        });

        const feedResponse = page
          .waitForResponse(isPath(FEED_JSON_PATH), { timeout: RESPONSE_TIMEOUT_MS })
          .catch(() => null);
        await page.goto(`${origin}${FEED_PATH}`, { waitUntil: 'domcontentloaded' });
        // Sin sesión, el portal redirige a la portada.
        if (new URL(page.url()).pathname !== FEED_PATH) throw new SessionExpiredError();
        const response = await feedResponse;
        if (response && [401, 403].includes(response.status())) throw new SessionExpiredError();
        if (!response?.ok()) {
          throw new PortalChangedError('El portal no entregó el feed de ofertas.');
        }

        const first = parseFeedPage(await response.json().catch(() => null), origin);
        saved = first.preferences;
        const found = new Map<string, JobListing>();
        const warnings: string[] = [];
        let skipped = first.skipped;
        for (const listing of first.listings) found.set(listing.externalId, listing);

        // Una tanda con menos ofertas que el tamaño de página es la última.
        let reachedEnd = first.received < first.pageSize;
        const more = page.getByRole('button', { name: 'Cargar más ofertas' });
        while (!reachedEnd && found.size < maxListings) {
          // La página muestra el botón cuando termina de dibujar la tanda; si no aparece, no
          // quedan más ofertas.
          const canLoadMore = await more
            .waitFor({ state: 'visible', timeout: RENDER_TIMEOUT_MS })
            .then(() => true)
            .catch(() => false);
          if (!canLoadMore) {
            reachedEnd = true;
            break;
          }
          await ctx.throttle();
          const drawn = await cards(page).count();
          const request = await Promise.all([
            page.waitForRequest(isPath(MORE_OFFERS_PATH), { timeout: RESPONSE_TIMEOUT_MS }),
            more.click(),
          ])
            .then(([sent]) => sent)
            .catch(() => null);
          const moreResponse = await request?.response().catch(() => null);
          if (blocked) {
            ctx.logger.warn('Se bloqueó una consulta que cambiaba las preferencias');
            warnings.push(
              'El portal intentó enviar condiciones distintas a las guardadas en la cuenta. ' +
                'La consulta se bloqueó para no modificarlas y la lectura quedó incompleta.',
            );
            break;
          }
          if (!moreResponse?.ok()) {
            warnings.push('El portal dejó de responder antes de terminar el feed.');
            break;
          }
          const next = parseFeedPage(await moreResponse.json().catch(() => null), origin);
          for (const listing of next.listings) found.set(listing.externalId, listing);
          skipped += next.skipped;
          reachedEnd = next.received < next.pageSize;
          // Antes de mirar el botón otra vez, se espera a que la página dibuje esta tanda.
          if (!reachedEnd) {
            await page
              .waitForFunction(
                ([selector, before]) => document.querySelectorAll(selector).length > before,
                [CARD_SELECTOR, drawn] as const,
                { timeout: RENDER_TIMEOUT_MS },
              )
              .catch(() => {});
          }
        }

        if (skipped > 0) {
          warnings.push(`${skipped} ofertas venían incompletas y no se pudieron leer.`);
        }
        const listings = [...found.values()].slice(0, maxListings);
        ctx.logger.info('Feed leído', { listings: listings.length, reachedEnd });
        return {
          listings,
          conditions: saved ? describePreferences(saved, await readTaxonomy(page)) : [],
          reachedEnd: reachedEnd && found.size <= maxListings,
          warnings,
        };
      } catch (error) {
        if (!(error instanceof SessionExpiredError)) await saveEvidence(ctx, page, 'feed');
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    },

    async getDetail(ctx: SourceContext, listing) {
      const url = new URL(listing.url);
      // El navegador lleva la sesión del usuario: solo abre páginas del portal.
      if (url.origin !== new URL(origin).origin) {
        throw new Error('La oferta no es de este portal');
      }
      const page = await ctx.browser.newPage();
      try {
        const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
        if (response?.status() === 404) {
          return {
            description: null,
            tags: [],
            benefits: [],
            applyUrl: null,
            closed: true,
            raw: null,
          };
        }
        return await readJobDetail(page);
      } catch (error) {
        await saveEvidence(ctx, page, `oferta-${listing.externalId.replace(/\W/g, '')}`);
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    },
  };
}

const isPath = (pathname: string) => (target: URL | { url(): string }) =>
  (target instanceof URL ? target : new URL(target.url())).pathname === pathname;

const cards = (page: Page) => page.locator(CARD_SELECTOR);

/** Deja una captura y el HTML de la página donde falló la lectura. Nunca hace fallar más. */
async function saveEvidence(ctx: SourceContext, page: Page, name: string): Promise<void> {
  try {
    await ctx.saveArtifact(`${name}.png`, await page.screenshot({ fullPage: true }));
    await ctx.saveArtifact(`${name}.html`, await page.content());
  } catch (error) {
    ctx.logger.warn('No se pudo guardar la evidencia de la falla', {
      error: (error as Error).message,
    });
  }
}

/** Preferencias que lleva una consulta de "Cargar más ofertas"; `null` si no se pueden leer. */
function sentPreferences(request: Request): PortalPreferences | null {
  if (request.method() !== 'POST') return null;
  try {
    const body: unknown = request.postDataJSON();
    const sent = (body as { preferences?: unknown } | null)?.preferences;
    return sent !== null && typeof sent === 'object' ? (sent as PortalPreferences) : null;
  } catch {
    return null;
  }
}

/** Nombres de las categorías, niveles, países y jornadas, que la página trae en sus atributos. */
async function readTaxonomy(page: Page): Promise<PortalTaxonomy> {
  const data = await page
    .locator('#feed')
    .evaluate((el) => ({ ...(el as HTMLElement).dataset }), undefined, { timeout: 5_000 })
    .catch((): Record<string, string | undefined> => ({}));
  return {
    categories: parseTaxonomyList(data.categories),
    seniorities: parseTaxonomyList(data.seniorities),
    countries: parseTaxonomyList(data.countries),
    schedules: parseTaxonomyList(data.schedules),
    tags: parseTaxonomyList(data.tags),
  };
}
