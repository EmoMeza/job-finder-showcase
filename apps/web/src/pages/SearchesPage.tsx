import {
  PORTAL_STATUS_LABELS,
  RUN_STATUS_LABELS,
  RUN_TRIGGER_LABELS,
  SEARCH_INTERVAL_HOURS,
  SEARCH_INTERVAL_LABELS,
  type PortalSearch,
  type SearchIntervalHours,
  type SearchRun,
} from '@job-finder/shared';
import { ExternalLink } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { SELECT_CLASS } from '@/components/profile/wizard/fields';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import {
  artifactUrl,
  isRunning,
  useRefreshAfterRun,
  useRunSearch,
  useSearches,
  useSearchRuns,
  useSetSearchInterval,
} from '@/lib/searches';
import { cn } from '@/lib/utils';

/** Búsquedas del usuario: una por portal, con sus condiciones, su frecuencia y su historial. */
export function SearchesPage() {
  const searches = useSearches();

  return (
    <section className="max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Búsquedas</h1>
        <p className="text-muted-foreground">
          Cada portal se revisa con tu cuenta. Las ofertas que encuentra quedan en{' '}
          <Link to="/ofertas" className="font-semibold text-primary underline underline-offset-4">
            Ofertas
          </Link>
          .
        </p>
      </div>
      {searches.isPending && <p className="text-muted-foreground">Cargando…</p>}
      {searches.isError && <p className="text-destructive">No se pudieron cargar las búsquedas.</p>}
      {searches.data?.map((search) => (
        <SearchCard key={search.source} search={search} />
      ))}
    </section>
  );
}

function SearchCard({ search }: { search: PortalSearch }) {
  const run = useRunSearch(search.source);
  const refresh = useRefreshAfterRun(search.source);
  const running = isRunning(search);
  const connected = search.portalStatus === 'connected';

  // Cuando la búsqueda termina, se actualizan su historial y la lista de ofertas.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) refresh();
    wasRunning.current = running;
  }, [running, refresh]);

  return (
    <article
      aria-label={search.name}
      className="space-y-6 rounded-xl border border-linea-suave bg-card p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{search.name}</h2>
        {connected && (
          <Button onClick={() => run.mutate()} disabled={running || run.isPending}>
            {running || run.isPending ? 'Buscando…' : 'Buscar ahora'}
          </Button>
        )}
      </header>

      {!connected && <NotConnected search={search} />}
      {run.isError && (
        <p role="alert" className="text-sm text-destructive">
          {run.error.message}
        </p>
      )}
      {running && (
        <p role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold">
          {search.lastRun?.step ?? 'Buscando'}…
        </p>
      )}
      {!running && search.lastRun && <LastResult run={search.lastRun} />}

      <Conditions search={search} />
      {connected && <Frequency search={search} />}
      <History search={search} live={running} />
    </article>
  );
}

function NotConnected({ search }: { search: PortalSearch }) {
  return (
    <div className="space-y-3 rounded-lg bg-destacador-suave px-4 py-3">
      <p className="text-sm">
        {search.portalStatus === 'expired'
          ? `La sesión de ${search.name} venció. Vuelve a conectar tu cuenta para seguir buscando.`
          : `Conecta tu cuenta de ${search.name} para buscar sus ofertas.`}
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link to="/configuracion">
          {search.portalStatus === 'expired' ? PORTAL_STATUS_LABELS.expired : 'Conectar'}{' '}
          {search.name}
        </Link>
      </Button>
    </div>
  );
}

/** Resumen de la última búsqueda terminada, en una frase. */
function LastResult({ run }: { run: SearchRun }) {
  if (run.status === 'failed') {
    return (
      <div
        role="alert"
        className="space-y-1 rounded-lg border border-destructive px-3 py-2 text-sm"
      >
        <p className="font-semibold text-destructive">La última búsqueda falló</p>
        <p>{run.error}</p>
        <Artifacts run={run} />
      </div>
    );
  }
  return (
    <p className="text-sm">
      <strong>
        {run.added === 0
          ? 'Sin ofertas nuevas'
          : run.added === 1
            ? 'Una oferta nueva'
            : `${run.added} ofertas nuevas`}
      </strong>{' '}
      en la última búsqueda, de {run.found} que tiene el portal para ti.{' '}
      <Link to="/ofertas" className="font-semibold text-primary underline underline-offset-4">
        Ver ofertas
      </Link>
    </p>
  );
}

function Conditions({ search }: { search: PortalSearch }) {
  const inPortal = search.conditionsManagedIn === 'portal';

  return (
    <section aria-label="Condiciones de búsqueda" className="space-y-3">
      <h3 className="font-semibold">Condiciones de búsqueda</h3>
      {inPortal && (
        <p className="text-sm text-muted-foreground">
          Son las preferencias que tienes guardadas en {search.name}. Job Finder las lee, pero no
          las cambia: se modifican allá.
        </p>
      )}
      {search.conditions ? (
        <>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            {search.conditions.map(({ label, values }) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{values.join(', ')}</dd>
              </div>
            ))}
          </dl>
          {search.conditionsReadAt && (
            <p className="text-sm text-muted-foreground">
              Última lectura: {formatDateTime(search.conditionsReadAt)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm">Se leen de tu cuenta la primera vez que buscas.</p>
      )}
      {search.conditionsUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={search.conditionsUrl} target="_blank" rel="noreferrer">
            <ExternalLink />
            Cambiarlas en {search.name}
          </a>
        </Button>
      )}
    </section>
  );
}

function Frequency({ search }: { search: PortalSearch }) {
  const setInterval = useSetSearchInterval(search.source);
  const id = `frecuencia-${search.source}`;

  return (
    <section className="space-y-2">
      <label htmlFor={id} className="block font-semibold">
        Repetir la búsqueda
      </label>
      <select
        id={id}
        className={cn(SELECT_CLASS, 'w-auto')}
        value={search.intervalHours ?? ''}
        disabled={setInterval.isPending}
        onChange={(event) =>
          setInterval.mutate(
            event.target.value === '' ? null : (Number(event.target.value) as SearchIntervalHours),
          )
        }
      >
        <option value="">Solo cuando yo busque</option>
        {SEARCH_INTERVAL_HOURS.map((hours) => (
          <option key={hours} value={hours}>
            {SEARCH_INTERVAL_LABELS[hours]}
          </option>
        ))}
      </select>
      {setInterval.isError && (
        <p role="alert" className="text-sm text-destructive">
          {setInterval.error.message}
        </p>
      )}
    </section>
  );
}

function History({ search, live }: { search: PortalSearch; live: boolean }) {
  const runs = useSearchRuns(search.source, live);
  if (!runs.data || runs.data.length === 0) return null;

  return (
    <section aria-label="Últimas búsquedas" className="space-y-3">
      <h3 className="font-semibold">Últimas búsquedas</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b border-linea-suave text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-4 font-semibold">
                Inicio
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                Origen
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                Resultado
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Ofertas
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Nuevas
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea-suave">
            {runs.data.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RunRow({ run }: { run: SearchRun }) {
  const notes = [...run.warnings];
  if (run.status === 'success' && run.reachedEnd === false) {
    notes.push('Quedaron ofertas más antiguas sin leer en el portal.');
  }

  return (
    <tr className="align-top">
      <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(run.startedAt)}</td>
      <td className="py-2 pr-4">{RUN_TRIGGER_LABELS[run.trigger]}</td>
      <td className="space-y-1 py-2 pr-4">
        <span
          className={cn(
            'font-semibold',
            run.status === 'failed' && 'text-destructive',
            run.status === 'success' && 'text-primary',
          )}
        >
          {RUN_STATUS_LABELS[run.status]}
        </span>
        {run.error && <p>{run.error}</p>}
        {notes.map((note) => (
          <p key={note} className="text-muted-foreground">
            {note}
          </p>
        ))}
        <Artifacts run={run} />
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">{run.found}</td>
      <td className="py-2 text-right tabular-nums">{run.added}</td>
    </tr>
  );
}

const ARTIFACT_LABELS: Record<string, string> = {
  png: 'Captura de la página',
  html: 'HTML de la página',
};

/** Lo que mostraba el portal cuando la búsqueda falló. */
function Artifacts({ run }: { run: SearchRun }) {
  if (run.artifacts.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {run.artifacts.map((name) => (
        <li key={name}>
          <a
            href={artifactUrl(run.id, name)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline underline-offset-4"
          >
            {ARTIFACT_LABELS[name.split('.').pop() ?? ''] ?? name}
            {run.artifacts.length > 2 && ` (${name})`}
          </a>
        </li>
      ))}
    </ul>
  );
}
