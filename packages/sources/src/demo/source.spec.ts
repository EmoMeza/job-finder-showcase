import { chromium, type Browser, type BrowserContext } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PortalChangedError, SessionExpiredError } from '../errors.js';
import type { SourceContext } from '../types.js';
import { createDemoCatalog } from './catalog.js';
import { startDemoPortal, type DemoPortalOptions } from './portal.js';
import { createDemoSource } from './source.js';

const OFFERS = createDemoCatalog(5, new Date('2026-10-10T12:00:00'));

/** Preferencias con cada tipo de dato que guarda una cuenta. */
const PREFERENCES = {
  categoryIds: ['2', '3'],
  seniorityIds: ['2', '3'],
  countryIds: ['1'],
  scheduleIds: ['1'],
  tagIds: [],
  blockedCompanyIds: [15, 62],
  minSalary: 1500,
  remoteOnly: false,
};

const log = () => vi.fn<SourceContext['logger']['info']>();

describe('adaptador del portal de demostración (navegador real)', () => {
  let browser: Browser;
  let portal: Awaited<ReturnType<typeof startDemoPortal>>;
  let context: BrowserContext;

  /** Levanta el portal y deja un navegador con la sesión iniciada, como la que guarda la app. */
  async function start(options: DemoPortalOptions = {}, loggedIn = true) {
    portal = await startDemoPortal({
      offers: OFFERS,
      preferences: PREFERENCES,
      pageSize: 2,
      ...options,
    });
    context = await browser.newContext();
    if (loggedIn) {
      await context.addCookies([{ name: 'demo_session', value: 'ok', url: portal.origin }]);
    }
    const ctx: SourceContext = {
      browser: context,
      throttle: vi.fn<SourceContext['throttle']>(async () => {}),
      saveArtifact: vi.fn<SourceContext['saveArtifact']>(async () => {}),
      logger: { debug: log(), info: log(), warn: log(), error: log() },
    };
    return { source: createDemoSource(portal.origin), ctx };
  }

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterEach(async () => {
    await Promise.all([context.close(), portal.close()]);
  });

  afterAll(async () => {
    await browser.close();
  });

  it('trae todo el feed, tanda por tanda, con las ofertas normalizadas', async () => {
    const { source, ctx } = await start();

    const result = await source.search(ctx);

    expect(result.listings.map((listing) => listing.externalId)).toEqual(
      OFFERS.map((offer) => String(offer.id)),
    );
    expect(result.listings[0]).toMatchObject({
      url: `${portal.origin}${OFFERS[0]!.url}`,
      title: OFFERS[0]!.title,
      company: OFFERS[0]!.company,
      modality: 'hybrid',
      employmentType: 'full-time',
      publishedOn: '2026-10-10',
    });
    expect(result.reachedEnd).toBe(true);
    expect(result.warnings).toEqual([]);
    // 5 ofertas de a 2: la primera tanda llega con la página y las otras dos se piden con pausa.
    expect(ctx.throttle).toHaveBeenCalledTimes(2);
  });

  it('leer no cambia las preferencias guardadas en la cuenta', async () => {
    const { source, ctx } = await start();

    await source.search(ctx);

    expect(portal.account.preferences).toEqual(PREFERENCES);
    expect(portal.account.searches.map((search) => search.offset)).toEqual([2, 4]);
    for (const search of portal.account.searches) {
      expect(search.preferences).toEqual(PREFERENCES);
    }
  });

  it('bloquea la consulta si la página intenta enviar otras condiciones', async () => {
    const { source, ctx } = await start({ loadMoreChangesPreferences: true });

    const result = await source.search(ctx);

    expect(portal.account.searches).toEqual([]);
    expect(portal.account.preferences).toEqual(PREFERENCES);
    expect(result.listings).toHaveLength(2);
    expect(result.reachedEnd).toBe(false);
    expect(result.warnings[0]).toContain('condiciones distintas a las guardadas');
  });

  it('describe las condiciones con los nombres del portal', async () => {
    const { source, ctx } = await start();

    const { conditions } = await source.search(ctx, { maxListings: 2 });

    expect(conditions).toEqual([
      { label: 'Categorías', values: ['Programación', 'Datos'] },
      { label: 'Nivel', values: ['Junior', 'Semi Senior'] },
      { label: 'Países', values: ['Chile'] },
      { label: 'Jornada', values: ['Jornada completa'] },
      { label: 'Sueldo mínimo', values: ['USD 1500 al mes'] },
      { label: 'Empresas bloqueadas', values: ['2'] },
    ]);
  });

  it('respeta el tope de ofertas y avisa que quedaron sin leer', async () => {
    const { source, ctx } = await start();

    const result = await source.search(ctx, { maxListings: 3 });

    expect(result.listings).toHaveLength(3);
    expect(result.reachedEnd).toBe(false);
    expect(portal.account.searches).toHaveLength(1);
  });

  it('con el tope en la primera tanda no envía ninguna consulta', async () => {
    const { source, ctx } = await start();

    const result = await source.search(ctx, { maxListings: 2 });

    expect(result.listings).toHaveLength(2);
    expect(portal.account.searches).toEqual([]);
    expect(ctx.throttle).not.toHaveBeenCalled();
  });

  it('un feed sin ofertas termina vacío y completo', async () => {
    const { source, ctx } = await start({ offers: [] });

    const result = await source.search(ctx);

    expect(result.listings).toEqual([]);
    expect(result.reachedEnd).toBe(true);
  });

  it('si la sesión venció, lo informa', async () => {
    const { source, ctx } = await start({}, false);

    await expect(source.search(ctx)).rejects.toThrow(SessionExpiredError);
    expect(ctx.saveArtifact).not.toHaveBeenCalled();
  });

  it('si el portal responde otra cosa, falla y deja una captura y el HTML de la página', async () => {
    const { source, ctx } = await start();
    portal.faults.feedBroken = true;

    await expect(source.search(ctx)).rejects.toThrow(PortalChangedError);

    const saved = vi.mocked(ctx.saveArtifact).mock.calls;
    expect(saved.map(([name]) => name)).toEqual(['feed.png', 'feed.html']);
    expect(String(saved[1]![1])).toContain('Ofertas para ti');
  });

  it('lee el detalle de una oferta', async () => {
    const { source, ctx } = await start();

    const detail = await source.getDetail(ctx, {
      externalId: String(OFFERS[0]!.id),
      url: `${portal.origin}${OFFERS[0]!.url}`,
    });

    expect(detail.description).toContain('## Requisitos');
    expect(detail.tags).toEqual(OFFERS[0]!.skills);
    expect(detail.closed).toBe(false);
  });

  it('una oferta que ya no existe queda como cerrada', async () => {
    const { source, ctx } = await start();

    const detail = await source.getDetail(ctx, {
      externalId: '1',
      url: `${portal.origin}/ofertas/ya-no-existe`,
    });

    expect(detail).toMatchObject({ description: null, closed: true, applyUrl: null });
  });

  it('no abre con la sesión del usuario una página que no es del portal', async () => {
    const { source, ctx } = await start();

    await expect(
      source.getDetail(ctx, { externalId: '1', url: 'https://example.com/ofertas/x' }),
    ).rejects.toThrow('no es de este portal');
    expect(context.pages()).toHaveLength(0);
  });
});
