import {
  EMPLOYMENT_TYPE_LABELS,
  formatSalary,
  JOB_MODALITY_LABELS,
  SOURCE_LABELS,
  type JobSummary,
} from '@job-finder/shared';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { formatDay } from '@/lib/format';
import { useJobs } from '@/lib/jobs';

/** Ofertas que encontraron las búsquedas del usuario. */
export function JobsPage() {
  const jobs = useJobs();

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Ofertas</h1>
        {jobs.data && jobs.data.length > 0 && (
          <p className="text-muted-foreground">
            {jobs.data.length === 1
              ? 'Una oferta encontrada por tus búsquedas.'
              : `${jobs.data.length} ofertas encontradas por tus búsquedas, de la más reciente a la más antigua.`}
          </p>
        )}
      </div>
      {jobs.isPending && <p className="text-muted-foreground">Cargando…</p>}
      {jobs.isError && <p className="text-destructive">No se pudieron cargar las ofertas.</p>}
      {jobs.data?.length === 0 && <NoJobs />}
      {jobs.data && jobs.data.length > 0 && <JobsTable jobs={jobs.data} />}
    </section>
  );
}

function NoJobs() {
  return (
    <div className="max-w-xl space-y-3 rounded-xl border border-linea-suave bg-card p-5">
      <p className="font-semibold">Todavía no hay ofertas.</p>
      <p className="text-muted-foreground">
        Aparecen aquí cuando buscas en un portal con tu cuenta conectada.
      </p>
      <Button asChild>
        <Link to="/busquedas">Ir a Búsquedas</Link>
      </Button>
    </div>
  );
}

function JobsTable({ jobs }: { jobs: JobSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-linea-suave bg-card">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="border-b border-linea-suave text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Oferta
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Nivel y jornada
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Modalidad y lugar
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Sueldo
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Publicada
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea-suave">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  return (
    <tr className="align-top">
      <th scope="row" className="px-4 py-3 font-normal">
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-baseline gap-1.5 font-semibold text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary"
        >
          {job.title}
          <ExternalLink aria-hidden className="size-3.5 shrink-0 translate-y-0.5" />
          <span className="sr-only">(abre {SOURCE_LABELS[job.source]} en otra pestaña)</span>
        </a>
        <p className="text-muted-foreground">
          {job.company ?? 'Empresa sin informar'}, en {SOURCE_LABELS[job.source]}
        </p>
      </th>
      <td className="px-4 py-3">
        <p>{job.seniority ?? 'Sin informar'}</p>
        {job.employmentType && (
          <p className="text-muted-foreground">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <p>{job.modality ? JOB_MODALITY_LABELS[job.modality] : 'Sin informar'}</p>
        {job.location && <p className="text-muted-foreground">{job.location}</p>}
      </td>
      <td className="px-4 py-3">
        {job.salary ? (
          <>
            <p className="whitespace-nowrap">{formatSalary(job.salary)}</p>
            {!job.salary.public && (
              <p className="text-muted-foreground">La empresa no lo publica</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">Sin informar</p>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {job.publishedOn ? formatDay(job.publishedOn) : 'Sin fecha'}
      </td>
    </tr>
  );
}
