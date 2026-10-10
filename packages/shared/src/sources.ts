/**
 * Portales disponibles. `demo` es el portal de demostración incluido en el repo; `otro` existe
 * para mostrar cómo se ve un portal que todavía no tiene adaptador.
 */
export const SOURCE_IDS = ['demo', 'otro'] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

export const SOURCE_LABELS: Record<SourceId, string> = {
  demo: 'Empleos Demo',
  otro: 'Otro Portal',
};

export const JOB_MODALITIES = ['remote', 'hybrid', 'onsite'] as const;

export type JobModality = (typeof JOB_MODALITIES)[number];

export const JOB_MODALITY_LABELS: Record<JobModality, string> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
};

export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'freelance', 'internship'] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  'full-time': 'Jornada completa',
  'part-time': 'Media jornada',
  freelance: 'Freelance',
  internship: 'Práctica',
};
