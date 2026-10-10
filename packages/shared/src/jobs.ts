import type { EmploymentType, JobModality, SourceId } from './sources.js';
import type { JobStatus } from './tracking.js';

export interface JobSalary {
  min: number | null;
  max: number | null;
  currency: string;
  period: 'month' | 'year';
  basis: 'gross' | 'net' | null;
  /** `false` si el portal lo muestra solo a quien inició sesión. */
  public: boolean;
}

/** Una oferta en la lista del usuario. */
export interface JobSummary {
  id: number;
  source: SourceId;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  modality: JobModality | null;
  employmentType: EmploymentType | null;
  seniority: string | null;
  salary: JobSalary | null;
  /** Día de publicación, `AAAA-MM-DD`. */
  publishedOn: string | null;
  status: JobStatus;
  /** Cuándo la encontró por primera vez una búsqueda del usuario. */
  foundAt: string;
}

const amount = (value: number) => new Intl.NumberFormat('es-CL').format(value);

/** "USD 1.900 – 2.600 al mes". */
export function formatSalary(salary: JobSalary): string {
  const range =
    salary.min !== null && salary.max !== null && salary.min !== salary.max
      ? `${amount(salary.min)} – ${amount(salary.max)}`
      : amount((salary.min ?? salary.max)!);
  return `${salary.currency} ${range} ${salary.period === 'year' ? 'al año' : 'al mes'}`;
}
