import type { EmploymentType, JobModality } from '@job-finder/shared';
import { z } from 'zod';
import { PortalChangedError } from '../errors.js';
import type { AppliedCondition, JobListing, Salary } from '../types.js';

/**
 * Lectura del feed del portal de demostración. Ver docs/portal-demo.md.
 *
 * Aquí no hay navegador: son funciones puras que convierten lo que responde el portal en ofertas
 * normalizadas, para poder probarlas sin levantar nada.
 */

/** Solo se exige lo indispensable; el resto se lee si viene y la oferta cruda se guarda entera. */
const rawOfferSchema = z.looseObject({
  id: z.union([z.number(), z.string()]),
  url: z.string().min(1),
  title: z.string().min(1),
  company: z.string().nullish(),
  salaryRange: z.string().nullish(),
  salaryMin: z.number().nullish(),
  salaryMax: z.number().nullish(),
  salaryBasis: z.string().nullish(),
  salaryPublic: z.boolean().nullish(),
  seniority: z.string().nullish(),
  schedule: z.string().nullish(),
  workMode: z.string().nullish(),
  locationText: z.string().nullish(),
  cities: z.array(z.looseObject({ name: z.string().nullish() })).nullish(),
  countries: z.string().nullish(),
  publishedAt: z.string().nullish(),
  requiresLinkedin: z.boolean().nullish(),
  requiresGithub: z.boolean().nullish(),
  requiresPortfolio: z.boolean().nullish(),
  hasScoredQuestions: z.boolean().nullish(),
  quickApply: z.boolean().nullish(),
});

type RawOffer = z.infer<typeof rawOfferSchema>;

/**
 * Preferencias guardadas en la cuenta. Se tratan como una caja cerrada: se leen para mostrarlas
 * y para comprobar que la página las reenvía sin cambios, pero nunca se modifican.
 */
export type PortalPreferences = Record<string, unknown>;

const feedSchema = z.object({
  offers: z.array(z.unknown()),
  meta: z.looseObject({
    pageSize: z.number().int().positive().catch(25),
    preferences: z.record(z.string(), z.unknown()).optional(),
  }),
});

export interface FeedPage {
  listings: JobListing[];
  /** Ofertas que el portal envía por tanda. Una tanda con menos es la última. */
  pageSize: number;
  /** Cuántas ofertas traía la tanda, antes de descartar las que no se pudieron leer. */
  received: number;
  preferences: PortalPreferences | null;
  /** Ofertas descartadas por no traer id, enlace o título. */
  skipped: number;
}

/** Convierte una respuesta del feed (la primera tanda o las siguientes). */
export function parseFeedPage(body: unknown, origin: string): FeedPage {
  const feed = feedSchema.safeParse(body);
  if (!feed.success) {
    throw new PortalChangedError('El portal respondió el feed con un formato que no reconozco.');
  }
  const listings: JobListing[] = [];
  for (const offer of feed.data.offers) {
    const listing = parseFeedOffer(offer, origin);
    if (listing) listings.push(listing);
  }
  const received = feed.data.offers.length;
  // Si no se pudo leer ninguna oferta de la tanda, lo que cambió es el formato.
  if (received > 0 && listings.length === 0) {
    throw new PortalChangedError('El portal cambió el formato de sus ofertas.');
  }
  return {
    listings,
    pageSize: feed.data.meta.pageSize,
    received,
    preferences: feed.data.meta.preferences ?? null,
    skipped: received - listings.length,
  };
}

/** Normaliza una oferta del feed. Devuelve `null` si le falta lo indispensable. */
export function parseFeedOffer(offer: unknown, origin: string): JobListing | null {
  const parsed = rawOfferSchema.safeParse(offer);
  if (!parsed.success) return null;
  const raw = parsed.data;
  const countries = splitList(raw.countries);
  return {
    externalId: String(raw.id),
    url: new URL(raw.url, origin).toString(),
    title: raw.title.trim(),
    company: clean(raw.company),
    location: clean(raw.locationText) ?? (countries.join(', ') || null),
    cities: unique((raw.cities ?? []).map((city) => clean(city.name))),
    countries,
    modality: parseModality(raw.workMode),
    employmentType: parseEmploymentType(raw.schedule),
    seniority: clean(raw.seniority),
    salary: parseSalary(raw),
    publishedOn: parseSpanishDate(raw.publishedAt),
    applyNotes: applyNotes(raw),
    raw: offer,
  };
}

function parseModality(value: string | null | undefined): JobModality | null {
  return value === 'onsite' || value === 'hybrid' || value === 'remote' ? value : null;
}

function parseEmploymentType(value: string | null | undefined): EmploymentType | null {
  const text = (value ?? '').toLowerCase();
  if (text.includes('completa')) return 'full-time';
  if (text.includes('media')) return 'part-time';
  if (text.includes('freelance')) return 'freelance';
  if (text.includes('práctica')) return 'internship';
  return null;
}

/**
 * El portal publica los sueldos en dólares al mes. Con sesión, el rango viene como texto
 * ("1900 - 2600") aunque la empresa no lo muestre públicamente.
 */
export function parseSalary(
  raw: Pick<RawOffer, 'salaryRange' | 'salaryMin' | 'salaryMax' | 'salaryBasis' | 'salaryPublic'>,
): Salary | null {
  const fromText = (raw.salaryRange ?? '').match(/\d+/g)?.map(Number) ?? [];
  const min = positive(raw.salaryMin) ?? positive(fromText[0]);
  const max = positive(raw.salaryMax) ?? positive(fromText[1]);
  if (min === null && max === null) return null;
  return {
    min,
    max,
    currency: 'USD',
    period: 'month',
    basis: raw.salaryBasis === 'gross' ? 'gross' : raw.salaryBasis === 'net' ? 'net' : null,
    public: raw.salaryPublic === true,
  };
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "09 de octubre de 2026" → "2026-10-09". */
export function parseSpanishDate(value: string | null | undefined): string | null {
  const match = (value ?? '')
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2}) de ([a-zé]+) de (\d{4})$/);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = MONTHS.indexOf(monthName === 'setiembre' ? 'septiembre' : (monthName ?? ''));
  if (month < 0 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${day?.padStart(2, '0')}`;
}

function applyNotes(raw: RawOffer): string[] {
  const notes: string[] = [];
  if (raw.requiresLinkedin) notes.push('Pide perfil de LinkedIn');
  if (raw.requiresGithub) notes.push('Pide perfil de GitHub');
  if (raw.requiresPortfolio) notes.push('Pide portafolio');
  if (raw.hasScoredQuestions) notes.push('Tiene preguntas con puntaje');
  if (raw.quickApply) notes.push('Permite postulación rápida');
  return notes;
}

/** Listas con nombre e id que la página trae para dibujar sus filtros. */
export interface PortalTaxonomy {
  categories: TaxonomyEntry[];
  seniorities: TaxonomyEntry[];
  countries: TaxonomyEntry[];
  schedules: TaxonomyEntry[];
  tags: TaxonomyEntry[];
}

type TaxonomyEntry = [label: string, id: number | string];

const taxonomyListSchema = z.array(z.tuple([z.string(), z.union([z.number(), z.string()])]));

/** Lee una de las listas de la página (`data-categories`…). Si no se entiende, queda vacía. */
export function parseTaxonomyList(json: string | null | undefined): TaxonomyEntry[] {
  try {
    return taxonomyListSchema.parse(JSON.parse(json ?? '[]'));
  } catch {
    return [];
  }
}

/**
 * Las preferencias guardadas vienen como ids. Esto las pasa a texto para mostrarle al usuario con
 * qué condiciones el portal armó su feed.
 */
export function describePreferences(
  preferences: PortalPreferences,
  taxonomy: PortalTaxonomy,
): AppliedCondition[] {
  // Un id sin nombre es una opción que la página tampoco muestra entre sus filtros: se omite.
  const names = (key: string, entries: TaxonomyEntry[]): string[] => {
    const labels = new Map(entries.map(([label, id]) => [String(id), label.trim()]));
    return idList(preferences[key]).flatMap((id) => labels.get(id) ?? []);
  };
  const conditions: AppliedCondition[] = [
    { label: 'Categorías', values: names('categoryIds', taxonomy.categories) },
    { label: 'Nivel', values: names('seniorityIds', taxonomy.seniorities) },
    { label: 'Países', values: names('countryIds', taxonomy.countries) },
    { label: 'Jornada', values: names('scheduleIds', taxonomy.schedules) },
    { label: 'Etiquetas', values: names('tagIds', taxonomy.tags) },
  ];
  const minSalary = positive(preferences.minSalary);
  if (minSalary !== null) {
    conditions.push({ label: 'Sueldo mínimo', values: [`USD ${minSalary} al mes`] });
  }
  if (preferences.remoteOnly === true) {
    conditions.push({ label: 'Solo empleos remotos', values: ['Sí'] });
  }
  const blocked = idList(preferences.blockedCompanyIds).length;
  if (blocked > 0) {
    conditions.push({ label: 'Empresas bloqueadas', values: [String(blocked)] });
  }
  return conditions.filter((condition) => condition.values.length > 0);
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function clean(value: string | null | undefined): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text || null;
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

/** "Chile, Perú o México" → ["Chile", "Perú", "México"]. */
function splitList(value: string | null | undefined): string[] {
  return unique((value ?? '').split(/,|\s+[ou]\s+/).map(clean));
}
