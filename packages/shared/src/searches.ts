import { z } from 'zod';
import type { PortalStatus } from './portals.js';
import type { SourceId } from './sources.js';

/** Cada cuántas horas se repite sola una búsqueda. `null`: solo cuando el usuario la pide. */
export const SEARCH_INTERVAL_HOURS = [6, 12, 24] as const;

export type SearchIntervalHours = (typeof SEARCH_INTERVAL_HOURS)[number];

export const SEARCH_INTERVAL_LABELS: Record<SearchIntervalHours, string> = {
  6: 'Cada 6 horas',
  12: 'Cada 12 horas',
  24: 'Una vez al día',
};

export const RUN_STATUSES = ['running', 'success', 'failed'] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  running: 'En curso',
  success: 'Lista',
  failed: 'Falló',
};

export const RUN_TRIGGERS = ['manual', 'scheduled'] as const;

export type RunTrigger = (typeof RUN_TRIGGERS)[number];

export const RUN_TRIGGER_LABELS: Record<RunTrigger, string> = {
  manual: 'Manual',
  scheduled: 'Automática',
};

/** Una condición con la que el portal armó el resultado, en texto para mostrar. */
export interface SearchCondition {
  label: string;
  values: string[];
}

/** Una ejecución de la búsqueda de un portal. */
export interface SearchRun {
  id: number;
  trigger: RunTrigger;
  status: RunStatus;
  /** Qué está haciendo mientras corre ("Leyendo el detalle (3 de 12)"). */
  step: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** Ofertas que entregó el portal. */
  found: number;
  /** Cuántas de esas el usuario no tenía. */
  added: number;
  /** `false` si quedaron ofertas sin leer en el portal. */
  reachedEnd: boolean | null;
  warnings: string[];
  error: string | null;
  /** Capturas guardadas cuando falla, para revisar qué mostraba el portal. */
  artifacts: string[];
}

/** La búsqueda de un usuario en un portal, con lo necesario para mostrarla. */
export interface PortalSearch {
  source: SourceId;
  name: string;
  portalStatus: PortalStatus;
  /** Si el portal está incluido en las búsquedas del usuario. */
  enabled: boolean;
  /**
   * Dónde se definen las condiciones: en el portal (la app solo las muestra) o en la app.
   * Ver ADR 0013.
   */
  conditionsManagedIn: 'portal' | 'app';
  /** Página del portal donde se cambian, si se gestionan allá. */
  conditionsUrl: string | null;
  /** Condiciones leídas en la última búsqueda. `null` si todavía no se ha buscado. */
  conditions: SearchCondition[] | null;
  conditionsReadAt: string | null;
  intervalHours: SearchIntervalHours | null;
  lastRun: SearchRun | null;
}

export const updateSearchSchema = z.object({
  intervalHours: z.union(SEARCH_INTERVAL_HOURS.map((hours) => z.literal(hours))).nullable(),
});

export type UpdateSearchRequest = z.infer<typeof updateSearchSchema>;
