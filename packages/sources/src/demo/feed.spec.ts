import { describe, expect, it } from 'vitest';
import { PortalChangedError } from '../errors.js';
import type { DemoOffer } from './catalog.js';
import {
  describePreferences,
  parseFeedOffer,
  parseFeedPage,
  parseSalary,
  parseSpanishDate,
  parseTaxonomyList,
} from './feed.js';

const ORIGIN = 'https://portal.example';

const offer = (changes: Partial<DemoOffer> = {}): DemoOffer => ({
  id: 4821,
  url: '/ofertas/desarrollador-front-end-acme-4821',
  title: 'Desarrollador/a Front-end',
  company: 'Acme',
  salaryRange: '1900 - 2600',
  salaryMin: null,
  salaryMax: null,
  salaryBasis: 'gross',
  salaryPublic: false,
  seniority: 'Semi Senior',
  schedule: 'Jornada completa',
  workMode: 'hybrid',
  locationText: 'Santiago (Chile)',
  cities: [{ id: 1, name: 'Santiago' }],
  countries: 'Chile',
  publishedAt: '10 de octubre de 2026',
  requiresLinkedin: false,
  requiresGithub: false,
  requiresPortfolio: false,
  hasScoredQuestions: false,
  quickApply: false,
  ...changes,
});

const PREFERENCES = {
  categoryIds: ['2'],
  seniorityIds: ['3'],
  countryIds: ['1'],
  scheduleIds: ['1'],
};

const feed = (offers: unknown[]) => ({
  offers,
  meta: { nextOffset: offers.length, pageSize: 25, preferences: PREFERENCES },
});

describe('parseFeedPage', () => {
  it('normaliza una oferta híbrida con sueldo que la empresa no publica', () => {
    const raw = offer();

    const page = parseFeedPage(feed([raw]), ORIGIN);

    expect(page.listings).toEqual([
      {
        externalId: '4821',
        url: 'https://portal.example/ofertas/desarrollador-front-end-acme-4821',
        title: 'Desarrollador/a Front-end',
        company: 'Acme',
        location: 'Santiago (Chile)',
        cities: ['Santiago'],
        countries: ['Chile'],
        modality: 'hybrid',
        employmentType: 'full-time',
        seniority: 'Semi Senior',
        salary: {
          min: 1900,
          max: 2600,
          currency: 'USD',
          period: 'month',
          basis: 'gross',
          public: false,
        },
        publishedOn: '2026-10-10',
        applyNotes: [],
        raw,
      },
    ]);
  });

  it('una oferta remota no tiene ciudades y lista los países donde se puede trabajar', () => {
    const remote = offer({
      workMode: 'remote',
      cities: [],
      countries: 'Chile, Perú o México',
      locationText: 'Chile, Perú o México',
      salaryMin: 3100,
      salaryMax: 4000,
      salaryPublic: true,
    });

    const [listing] = parseFeedPage(feed([remote]), ORIGIN).listings;

    expect(listing).toMatchObject({
      modality: 'remote',
      cities: [],
      countries: ['Chile', 'Perú', 'México'],
      location: 'Chile, Perú o México',
      salary: { min: 3100, max: 4000, public: true },
    });
  });

  it('anota lo que el portal pide para postular', () => {
    const demanding = offer({ requiresLinkedin: true, hasScoredQuestions: true });

    expect(parseFeedPage(feed([demanding]), ORIGIN).listings[0]?.applyNotes).toEqual([
      'Pide perfil de LinkedIn',
      'Tiene preguntas con puntaje',
    ]);
  });

  it('entrega el tamaño de tanda y las preferencias guardadas, sin tocarlas', () => {
    const page = parseFeedPage(feed([offer(), offer({ id: 2 })]), ORIGIN);

    expect(page.pageSize).toBe(25);
    expect(page.received).toBe(2);
    expect(page.preferences).toEqual(PREFERENCES);
  });

  it('descarta la oferta que no trae lo indispensable y lee las demás', () => {
    const result = parseFeedPage(feed([{ title: 'Sin id ni enlace' }, offer()]), ORIGIN);

    expect(result.listings).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it.each([
    ['una respuesta que no es el feed', { error: 'unauthorized' }],
    ['un cuerpo vacío', null],
    ['ofertas con otro formato', { offers: [{ nombre: 'x' }, { nombre: 'y' }], meta: {} }],
  ])('avisa que el portal cambió si llega %s', (_caso, body) => {
    expect(() => parseFeedPage(body, ORIGIN)).toThrow(PortalChangedError);
  });
});

describe('parseFeedOffer', () => {
  const base = { id: 1, url: '/ofertas/x', title: ' Analista ' };

  it('lee una oferta con solo lo indispensable', () => {
    expect(parseFeedOffer(base, ORIGIN)).toMatchObject({
      externalId: '1',
      title: 'Analista',
      company: null,
      location: null,
      modality: null,
      employmentType: null,
      salary: null,
      publishedOn: null,
    });
  });

  it.each([
    ['Jornada completa', 'full-time'],
    ['Media jornada', 'part-time'],
    ['Freelance', 'freelance'],
    ['Práctica', 'internship'],
    ['Otra cosa', null],
  ])('jornada "%s" → %s', (schedule, expected) => {
    expect(parseFeedOffer({ ...base, schedule }, ORIGIN)?.employmentType).toBe(expected);
  });

  it.each([
    ['onsite', 'onsite'],
    ['hybrid', 'hybrid'],
    ['remote', 'remote'],
    ['en la luna', null],
  ])('modalidad "%s" → %s', (workMode, expected) => {
    expect(parseFeedOffer({ ...base, workMode }, ORIGIN)?.modality).toBe(expected);
  });
});

describe('parseSalary', () => {
  it('prefiere los montos numéricos cuando vienen', () => {
    expect(parseSalary({ salaryRange: '1 - 2', salaryMin: 2000, salaryMax: 2500 })).toMatchObject({
      min: 2000,
      max: 2500,
    });
  });

  it('acepta un solo monto', () => {
    expect(parseSalary({ salaryRange: '1500' })).toMatchObject({ min: 1500, max: null });
  });

  it.each([[null], [''], ['0 - 0'], ['A convenir']])(
    'sin sueldo informado (%s) → null',
    (salaryRange) => {
      expect(parseSalary({ salaryRange })).toBeNull();
    },
  );
});

describe('parseSpanishDate', () => {
  it.each([
    ['09 de octubre de 2026', '2026-10-09'],
    ['1 de enero de 2027', '2027-01-01'],
    [' 30 de Septiembre de 2026 ', '2026-09-30'],
    ['10 oct', null],
    ['32 de enero de 2026', null],
    ['3 de brumario de 2026', null],
    [null, null],
  ])('%s → %s', (text, expected) => {
    expect(parseSpanishDate(text)).toBe(expected);
  });
});

describe('describePreferences', () => {
  const taxonomy = {
    categories: parseTaxonomyList('[["Diseño",1],["Programación",2]]'),
    seniorities: parseTaxonomyList('[["Junior",2],["Semi Senior",3]]'),
    countries: parseTaxonomyList('[["Chile",1]]'),
    schedules: parseTaxonomyList('[["Jornada completa",1]]'),
    tags: parseTaxonomyList('no es json'),
  };

  it('pasa los ids de las preferencias a los nombres que usa el portal', () => {
    expect(describePreferences(PREFERENCES, taxonomy)).toEqual([
      { label: 'Categorías', values: ['Programación'] },
      { label: 'Nivel', values: ['Semi Senior'] },
      { label: 'Países', values: ['Chile'] },
      { label: 'Jornada', values: ['Jornada completa'] },
    ]);
  });

  it('agrega sueldo mínimo, solo remotos y empresas bloqueadas, y omite los ids sin nombre', () => {
    const preferences = {
      categoryIds: ['2', '99'],
      tagIds: [7],
      minSalary: 1500,
      remoteOnly: true,
      blockedCompanyIds: [4, 8],
    };

    expect(describePreferences(preferences, taxonomy)).toEqual([
      { label: 'Categorías', values: ['Programación'] },
      { label: 'Sueldo mínimo', values: ['USD 1500 al mes'] },
      { label: 'Solo empleos remotos', values: ['Sí'] },
      { label: 'Empresas bloqueadas', values: ['2'] },
    ]);
  });
});
