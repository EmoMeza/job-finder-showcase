import type { EmploymentType, JobModality, JobSalary, SourceId } from '@job-finder/shared';
import type { BrowserContext } from 'playwright';
import type { PortalConnection } from './connection.js';

/**
 * Contrato de un adaptador de portal. Ver docs/arquitectura.md > "Contrato de un adaptador".
 *
 * Un adaptador lee el portal **con la sesión del usuario** y devuelve las ofertas ya
 * normalizadas. Leer nunca debe dejar huella en la cuenta (ADR 0013): cada adaptador documenta
 * qué acciones escriben y cómo las evita.
 */
export interface JobSource {
  id: SourceId;
  /** Cómo conecta el usuario su cuenta. */
  connection: PortalConnection;
  conditions: SourceConditions;
  search(ctx: SourceContext, options?: SearchOptions): Promise<SearchResult>;
  getDetail(
    ctx: SourceContext,
    listing: Pick<JobListing, 'externalId' | 'url'>,
  ): Promise<JobDetail>;
}

/**
 * De dónde salen las condiciones de búsqueda:
 * - `portal`: son las que el usuario tiene guardadas en el portal. La app las muestra y enlaza a
 *   `url` para cambiarlas allá.
 * - `app`: se editan en la app, con un formulario armado desde `filters`, y se envían en cada
 *   búsqueda.
 */
export type SourceConditions =
  { managedIn: 'portal'; url: string } | { managedIn: 'app'; filters: FilterDefinition[] };

interface BaseFilter {
  key: string;
  label: string;
}

export type FilterDefinition =
  | (BaseFilter & { type: 'text'; placeholder?: string })
  | (BaseFilter & { type: 'boolean' })
  | (BaseFilter & { type: 'select' | 'multiselect'; options: FilterOption[] });

export interface FilterOption {
  value: string;
  label: string;
}

export type FilterValues = Record<string, string | string[] | boolean | undefined>;

export interface SearchOptions {
  /** Valores de los filtros, solo para portales cuyas condiciones se editan en la app. */
  filters?: FilterValues;
  /** Tope de ofertas a traer. El adaptador deja de pedir páginas al alcanzarlo. */
  maxListings?: number;
}

export interface SearchResult {
  listings: JobListing[];
  /** Condiciones con las que el portal armó el resultado, en texto para mostrarlas. */
  conditions: AppliedCondition[];
  /** `false` si quedaron ofertas sin leer (se alcanzó el tope o la lectura se interrumpió). */
  reachedEnd: boolean;
  /** Avisos para quien revisa la ejecución; una lectura con avisos igual trae ofertas. */
  warnings: string[];
}

export interface AppliedCondition {
  label: string;
  values: string[];
}

/** Oferta tal como aparece en el listado de resultados, ya normalizada. */
export interface JobListing {
  /** Id estable dentro del portal; junto con el `SourceId` identifica la oferta. */
  externalId: string;
  url: string;
  title: string;
  company: string | null;
  /** Ubicación en una frase, lista para mostrar. */
  location: string | null;
  cities: string[];
  countries: string[];
  /** Presencial, híbrido o remoto. */
  modality: JobModality | null;
  /** Jornada. */
  employmentType: EmploymentType | null;
  /** Nivel con las palabras del portal ("Semi Senior", "Sin experiencia requerida"…). */
  seniority: string | null;
  salary: Salary | null;
  /** Día de publicación, `AAAA-MM-DD`. Los portales no informan la hora. */
  publishedOn: string | null;
  /** Lo que el portal pide para postular, en texto para mostrar ("Pide LinkedIn"…). */
  applyNotes: string[];
  /** Datos crudos del portal, guardados para debug y reprocesamiento. */
  raw: unknown;
}

export interface JobDetail {
  /** Descripción completa en Markdown, con las secciones que puso la empresa. */
  description: string | null;
  tags: string[];
  benefits: string[];
  /** Página donde se postula; `null` si la oferta no permite postular. */
  applyUrl: string | null;
  /** La oferta ya no recibe postulaciones. */
  closed: boolean;
  raw: unknown;
}

export type Salary = JobSalary;

export interface SourceContext {
  /** Navegador con la sesión del usuario ya cargada. */
  browser: BrowserContext;
  /** Pausa entre páginas del portal, para no leerlo más rápido que una persona. */
  throttle(): Promise<void>;
  /**
   * Guarda una captura o el HTML de lo que mostraba el portal cuando algo falló, para revisarlo
   * después. Puede contener datos de la cuenta: solo lo ve su dueño.
   */
  saveArtifact(name: string, content: string | Uint8Array): Promise<void>;
  logger: SourceLogger;
}

export interface SourceLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
