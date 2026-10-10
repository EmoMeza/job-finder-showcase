import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createDemoCatalog, type DemoCatalogEntry, type DemoOffer } from './catalog.js';

export interface DemoPortalOptions {
  /** Puerto donde escucha. Por defecto, uno libre cualquiera. */
  port?: number;
  host?: string;
  /** Ofertas del portal. Por defecto, un catálogo inventado. */
  offers?: DemoCatalogEntry[];
  /** Preferencias guardadas en la cuenta. */
  preferences?: Record<string, unknown>;
  /** Ofertas por tanda del feed. */
  pageSize?: number;
  /** Enlaces de ingreso que valen siempre, para los tests. Los que pide una persona valen una vez. */
  tokens?: string[];
  /**
   * Simula que la página cambió y "Cargar más ofertas" envía filtros distintos a los guardados,
   * para probar que el adaptador bloquea esa consulta.
   */
  loadMoreChangesPreferences?: boolean;
}

/** Fallas que se pueden encender y apagar con el portal andando. */
export interface DemoPortalFaults {
  /** El feed responde algo que no son ofertas, como si el portal hubiera cambiado. */
  feedBroken: boolean;
  /** El portal dejó de reconocer la sesión, como cuando vence. */
  sessionRevoked: boolean;
}

const SESSION_COOKIE = 'demo_session';

const DEFAULT_PREFERENCES = {
  categoryIds: ['2', '3'],
  seniorityIds: ['2', '3'],
  countryIds: ['1'],
  scheduleIds: ['1'],
  tagIds: [],
  blockedCompanyIds: [],
  minSalary: 1500,
  remoteOnly: false,
};

/** Nombres de los filtros, que la página trae para dibujarlos. */
const TAXONOMY = {
  categories: [
    ['Diseño', 1],
    ['Programación', 2],
    ['Datos', 3],
    ['Operaciones', 4],
  ],
  seniorities: [
    ['Sin experiencia', 1],
    ['Junior', 2],
    ['Semi Senior', 3],
    ['Senior', 4],
  ],
  countries: [
    ['Chile', 1],
    ['Perú', 2],
    ['México', 3],
  ],
  schedules: [
    ['Jornada completa', 1],
    ['Media jornada', 2],
  ],
  tags: [
    ['React', 10],
    ['SQL', 11],
  ],
};

const WORK_MODE_LABELS = { onsite: 'Presencial', hybrid: 'Híbrido', remote: 'Remoto' };

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char,
  );

/** Texto con `**negritas**` a HTML. */
const rich = (text: string) => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const attribute = (value: unknown) => escapeHtml(JSON.stringify(value));

const STYLES = `
  body { font-family: system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; color: #1f2a44; line-height: 1.5; }
  header.sitio { display: flex; justify-content: space-between; border-bottom: 1px solid #d3dae3; padding-bottom: .5rem; margin-bottom: 1.5rem; }
  a { color: #1d5c63; }
  a.oferta { display: block; padding: .6rem 0; border-bottom: 1px solid #d3dae3; }
  button, .boton { font: inherit; padding: .45rem .9rem; border-radius: .5rem; border: 1px solid #1d5c63; background: #1d5c63; color: #fff; cursor: pointer; text-decoration: none; }
  code { display: block; padding: .6rem; background: #eef1f5; border-radius: .5rem; overflow-wrap: anywhere; }
  .aviso { background: #fff6c2; padding: .6rem .8rem; border-radius: .5rem; }
  .marca { display: none; }
`;

const layout = (title: string, body: string) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Empleos Demo</title>
    <style>${STYLES}</style>
  </head>
  <body>
    <header class="sitio"><strong>Empleos Demo</strong><span>Portal ficticio de demostración</span></header>
    ${body}
  </body>
</html>`;

/** Página "Para ti": pide el feed al cargar y más ofertas con su botón. */
const feedPage = (changePreferences: boolean) => `
  <h1>Ofertas para ti</h1>
  <p>Estas ofertas se arman con las preferencias guardadas en tu cuenta.</p>
  <div id="feed" ${Object.entries(TAXONOMY)
    .map(([name, list]) => `data-${name}="${attribute(list)}"`)
    .join(' ')}>
    <div id="resultados"></div>
    <p><button type="button" id="mas" hidden>Cargar más ofertas</button></p>
  </div>
  <p><a href="/postulaciones">Tus postulaciones</a></p>
  <script>
    let preferences;
    let offset = 0;
    const more = document.querySelector('#mas');
    const show = (data) => {
      for (const offer of data.offers) {
        const card = document.createElement('a');
        card.className = 'oferta';
        card.href = offer.url;
        card.textContent = offer.title + ' · ' + offer.company;
        document.querySelector('#resultados').append(card);
      }
      offset = data.meta.nextOffset;
      more.hidden = data.offers.length < data.meta.pageSize;
    };
    fetch('/para-ti.json')
      .then((response) => response.json())
      .then((data) => {
        preferences = data.meta.preferences;
        show(data);
      });
    more.addEventListener('click', () => {
      const sent = ${changePreferences ? '{ ...preferences, remoteOnly: true }' : 'preferences'};
      fetch('/ofertas/mas.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset, preferences: sent }),
      })
        .then((response) => response.json())
        .then(show);
    });
  </script>`;

/** Página de una oferta, con su contenido marcado con `itemprop` (schema.org). */
function offerPage(offer: DemoCatalogEntry): string {
  const sections = (offer.sections ?? [])
    .map(
      (section) => `
      <section>
        <h3>${escapeHtml(section.title)}</h3>
        <div class="texto">
          ${(section.paragraphs ?? []).map((text) => `<p>${rich(text)}</p>`).join('')}
          ${section.items ? `<ul>${section.items.map((item) => `<li>${rich(item)}</li>`).join('')}</ul>` : ''}
        </div>
      </section>`,
    )
    .join('');
  const benefits = (offer.benefits ?? [])
    .map(
      (benefit) =>
        `<div class="beneficio"><strong>${escapeHtml(benefit.name)}</strong> <span>${escapeHtml(benefit.description)}</span></div>`,
    )
    .join('');
  return `
    <main>
      <p itemprop="hiringOrganization"><strong itemprop="name">${escapeHtml(offer.company)}</strong></p>
      <h1><span itemprop="title">${escapeHtml(offer.title)}</span></h1>
      <p>
        <span itemprop="qualifications">${escapeHtml(offer.seniority)}</span> |
        ${escapeHtml(offer.schedule)} | ${WORK_MODE_LABELS[offer.workMode]} |
        ${escapeHtml(offer.locationText)}
      </p>
      ${
        offer.closed
          ? '<p class="aviso">Oferta finalizada</p>'
          : `<p><a class="boton" id="postular" href="${offer.url}/postular">Postular</a></p>`
      }
      <div itemprop="description">
        ${sections}
        <p class="marca">© Empleos Demo. Contenido de demostración.</p>
        ${benefits ? `<div class="beneficios">${benefits}</div>` : ''}
      </div>
      <p itemprop="skills">
        ${(offer.skills ?? []).map((skill) => `<a href="/etiquetas/${encodeURIComponent(skill)}">${escapeHtml(skill)}</a>`).join(' ')}
      </p>
    </main>`;
}

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

/** Lo que el feed entrega de cada oferta: sin los datos que solo están en su página. */
function toFeedOffer(entry: DemoCatalogEntry): DemoOffer {
  const {
    sections: _sections,
    skills: _skills,
    benefits: _benefits,
    closed: _closed,
    ...offer
  } = entry;
  return offer;
}

/**
 * Portal de empleo ficticio, para mostrar y probar la automatización sin tocar ningún sitio real.
 * Ver docs/portal-demo.md.
 *
 * - /ingresar                  → pide un enlace de ingreso (lo muestra en pantalla: no hay correo)
 * - /ingresar/enlace?token=…   → página de confirmación con el botón "Ingresar"
 * - /postulaciones             → solo con sesión; sin ella redirige a la portada
 * - /para-ti y /para-ti.json   → feed de ofertas, solo con sesión
 * - POST /ofertas/mas.json     → más ofertas; **guarda como preferencias lo que recibe**
 * - /ofertas/<oferta>          → página de una oferta
 *
 * `account` expone lo que quedó guardado en la cuenta, para comprobar que leer no la modifica, y
 * `faults` permite simular fallas.
 */
export async function startDemoPortal(options: DemoPortalOptions = {}) {
  const { port = 0, host = '127.0.0.1', pageSize = 25 } = options;
  const offers = options.offers ?? createDemoCatalog();
  const permanentTokens = new Set(options.tokens);
  const oneTimeTokens = new Set<string>();
  const account = {
    /** Preferencias guardadas; cambian si llega una búsqueda con otros filtros. */
    preferences: structuredClone(options.preferences ?? DEFAULT_PREFERENCES) as Record<
      string,
      unknown
    >,
    /** Cuerpo de cada consulta de "Cargar más ofertas" recibida. */
    searches: [] as { offset: number; preferences: Record<string, unknown> }[],
  };
  const faults: DemoPortalFaults = { feedBroken: false, sessionRevoked: false };
  const feed = (offset: number) => {
    const batch = offers.slice(offset, offset + pageSize);
    return {
      offers: batch.map(toFeedOffer),
      meta: { nextOffset: offset + batch.length, pageSize, preferences: account.preferences },
    };
  };
  let origin = '';

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const loggedIn =
      !faults.sessionRevoked && (req.headers.cookie ?? '').includes(`${SESSION_COOKIE}=ok`);
    const html = (title: string, body: string, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(layout(title, body));
    };
    const json = (body: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    const redirect = (location: string, headers: Record<string, string> = {}) => {
      res.writeHead(302, { Location: location, ...headers });
      res.end();
    };

    if (url.pathname === '/ingresar' && req.method === 'POST') {
      const token = randomBytes(16).toString('hex');
      // El enlace usa la misma dirección con que la persona llegó al portal.
      const address = req.headers.host ? `http://${req.headers.host}` : origin;
      oneTimeTokens.add(token);
      return html(
        'Tu enlace de ingreso',
        `<h1>Tu enlace de ingreso</h1>
         <p class="aviso">Un portal real lo enviaría a tu correo. Aquí se muestra en pantalla.</p>
         <p>Cópialo <strong>sin abrirlo</strong> y pégalo en Job Finder. Sirve una sola vez.</p>
         <code id="enlace">${address}/ingresar/enlace?token=${token}</code>`,
      );
    }
    if (url.pathname === '/ingresar') {
      return html(
        'Ingresar',
        `<h1>Ingresa a Empleos Demo</h1>
         <p>Este portal no usa contraseña: te entrega un enlace de ingreso de un solo uso.</p>
         <form method="post" action="/ingresar"><button>Pedir enlace de ingreso</button></form>`,
      );
    }
    if (url.pathname === '/ingresar/enlace') {
      const token = url.searchParams.get('token') ?? '';
      return html(
        'Confirma tu ingreso',
        `<h1>Confirma tu ingreso</h1><p>Confirma para continuar con tu cuenta.</p>
         <form method="post" action="/ingresar/confirmar?token=${encodeURIComponent(token)}"><button>Ingresar</button></form>`,
      );
    }
    if (url.pathname === '/ingresar/confirmar') {
      const token = url.searchParams.get('token') ?? '';
      if (permanentTokens.has(token) || oneTimeTokens.delete(token)) {
        return redirect('/para-ti', {
          'Set-Cookie': `${SESSION_COOKIE}=ok; Path=/; HttpOnly; Max-Age=604800`,
        });
      }
      return html(
        'El enlace venció',
        '<h1>El enlace venció</h1><p><a href="/ingresar">Pide uno nuevo</a></p>',
      );
    }
    if (url.pathname === '/postulaciones') {
      return loggedIn
        ? html('Tus postulaciones', '<h1>Tus postulaciones</h1><p>Todavía no postulas a nada.</p>')
        : redirect('/');
    }
    if (url.pathname === '/para-ti') {
      return loggedIn
        ? html('Ofertas para ti', feedPage(options.loadMoreChangesPreferences === true))
        : redirect('/');
    }
    if (url.pathname === '/para-ti.json') {
      if (!loggedIn) return json({ error: 'unauthorized' }, 401);
      return json(faults.feedBroken ? { aviso: 'Estamos en mantención' } : feed(0));
    }
    if (url.pathname === '/ofertas/mas.json' && req.method === 'POST') {
      if (!loggedIn) return json({ error: 'unauthorized' }, 401);
      return void readBody(req).then((body) => {
        const search = JSON.parse(body) as (typeof account.searches)[number];
        account.searches.push(search);
        account.preferences = search.preferences;
        json(feed(search.offset));
      });
    }
    if (url.pathname.startsWith('/ofertas/')) {
      const applying = url.pathname.endsWith('/postular');
      const path = applying ? url.pathname.slice(0, -'/postular'.length) : url.pathname;
      const offer = offers.find((item) => item.url === path);
      if (!offer) return html('No encontrada', '<h1>No encontramos esta página</h1>', 404);
      return applying
        ? html(
            'Postular',
            '<h1>Postulación de demostración</h1><p>Este portal no envía postulaciones.</p>',
          )
        : html(offer.title, offerPage(offer));
    }
    return html(
      'Inicio',
      `<h1>Empleos Demo</h1>
       <p>Portal de empleo ficticio. Sus ofertas y empresas son inventadas.</p>
       <p><a class="boton" href="/ingresar">Ingresar</a></p>`,
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address() as AddressInfo;
  origin = `http://${host === '0.0.0.0' ? 'localhost' : host}:${address.port}`;
  return {
    origin,
    account,
    faults,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
