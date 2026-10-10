import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PortalChangedError } from '../errors.js';
import { createDemoCatalog, type DemoCatalogEntry } from './catalog.js';
import { readJobDetail } from './detail.js';
import { startDemoPortal } from './portal.js';

const [base] = createDemoCatalog(1, new Date('2026-10-10T12:00:00'));
const OFFER: DemoCatalogEntry = {
  ...base!,
  url: '/ofertas/analista',
  title: 'Analista de datos',
  company: 'Acme',
  sections: [
    {
      title: 'Sobre el cargo',
      paragraphs: ['Buscamos un/a **Analista de datos** para el equipo.'],
    },
    { title: 'Requisitos', items: ['SQL avanzado.', 'Dos años de experiencia.'] },
  ],
  skills: ['SQL', 'Python'],
  benefits: [{ name: 'Computador', description: 'Acme entrega un computador.' }],
};
const CLOSED: DemoCatalogEntry = { ...OFFER, id: 2, url: '/ofertas/cerrada', closed: true };

describe('readJobDetail (navegador real sobre la página de una oferta)', () => {
  let browser: Browser;
  let page: Page;
  let portal: Awaited<ReturnType<typeof startDemoPortal>>;

  beforeAll(async () => {
    [browser, portal] = await Promise.all([
      chromium.launch(),
      startDemoPortal({ offers: [OFFER, CLOSED] }),
    ]);
    page = await browser.newPage();
  });

  afterAll(async () => {
    await Promise.all([browser.close(), portal.close()]);
  });

  it('lee la descripción en Markdown, con las secciones que puso la empresa', async () => {
    await page.goto(`${portal.origin}${OFFER.url}`);

    const { description } = await readJobDetail(page);

    expect(description).toBe(
      [
        '## Sobre el cargo',
        'Buscamos un/a **Analista de datos** para el equipo.',
        '## Requisitos',
        '- SQL avanzado.\n- Dos años de experiencia.',
      ].join('\n\n'),
    );
  });

  it('deja fuera los textos que el portal intercala y oculta', async () => {
    await page.goto(`${portal.origin}${OFFER.url}`);

    const detail = await readJobDetail(page);

    expect(await page.content()).toContain('Contenido de demostración');
    expect(detail.description).not.toContain('Contenido de demostración');
  });

  it('lee etiquetas, beneficios y dónde se postula', async () => {
    await page.goto(`${portal.origin}${OFFER.url}`);

    const detail = await readJobDetail(page);

    expect(detail.tags).toEqual(['SQL', 'Python']);
    expect(detail.benefits).toEqual(['Computador']);
    expect(detail.applyUrl).toBe(`${portal.origin}/ofertas/analista/postular`);
    expect(detail.closed).toBe(false);
  });

  it('una oferta finalizada queda cerrada y sin enlace para postular', async () => {
    await page.goto(`${portal.origin}${CLOSED.url}`);

    const detail = await readJobDetail(page);

    expect(detail.closed).toBe(true);
    expect(detail.applyUrl).toBeNull();
  });

  it('respeta listas anidadas, numeradas, negritas y enlaces', async () => {
    await page.setContent(`
      <span itemprop="title">Analista</span>
      <div itemprop="description">
        Texto <em>con <strong>mucho</strong></em><strong>, mucho </strong>énfasis y un <a href="https://example.com/bases">enlace</a>.
        <ol><li>Primero<ul><li>Detalle</li></ul></li><li>Segundo</li></ol>
        <p>Línea uno<br>Línea dos</p>
      </div>`);

    const { description } = await readJobDetail(page);

    expect(description).toBe(
      [
        'Texto con **mucho, mucho** énfasis y un [enlace](https://example.com/bases).',
        '1. Primero\n  - Detalle\n2. Segundo',
        'Línea uno\nLínea dos',
      ].join('\n\n'),
    );
  });

  it('avisa si la página no es una oferta', async () => {
    await page.setContent('<h1>Verifica que eres una persona</h1>');

    await expect(readJobDetail(page)).rejects.toThrow(PortalChangedError);
  });
});
