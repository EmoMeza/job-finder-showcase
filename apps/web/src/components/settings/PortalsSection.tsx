import { PORTAL_STATUS_LABELS, type PortalAccount } from '@job-finder/shared';
import { ExternalLink } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateTime } from '@/lib/format';
import {
  useCheckPortal,
  useConnectPortal,
  useDisconnectPortal,
  usePortals,
  useSetPortalEnabled,
} from '@/lib/portals';
import { cn } from '@/lib/utils';

/** Portales de empleo del usuario: cuáles se revisan y con qué cuenta. */
export function PortalsSection() {
  const portals = usePortals();

  return (
    <section aria-labelledby="portales" className="space-y-4">
      <div className="space-y-1">
        <h2 id="portales" className="text-lg font-semibold">
          Portales
        </h2>
        <p className="text-muted-foreground">
          Conecta tu cuenta de cada portal para ver sus ofertas y postular con ella. Tu sesión se
          guarda cifrada.
        </p>
      </div>
      {portals.isPending && <p className="text-muted-foreground">Cargando…</p>}
      {portals.isError && <p className="text-destructive">No se pudieron cargar los portales.</p>}
      {portals.data?.map((portal) => (
        <PortalCard key={portal.source} portal={portal} />
      ))}
    </section>
  );
}

function StatusBadge({ portal }: { portal: PortalAccount }) {
  if (!portal.available) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm text-muted-foreground">
        Próximamente
      </span>
    );
  }
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-sm font-semibold',
        portal.status === 'connected' && 'bg-primary text-primary-foreground',
        portal.status === 'expired' && 'bg-destacador text-foreground',
        portal.status === 'disconnected' && 'border border-input text-muted-foreground',
      )}
    >
      {PORTAL_STATUS_LABELS[portal.status]}
    </span>
  );
}

function PortalCard({ portal }: { portal: PortalAccount }) {
  const setEnabled = useSetPortalEnabled(portal.source);

  return (
    <article
      aria-label={portal.name}
      className={cn(
        'space-y-4 rounded-xl border border-linea-suave bg-card p-5',
        !portal.available && 'opacity-70',
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">{portal.name}</h3>
          <StatusBadge portal={portal} />
        </div>
        {portal.available && (
          <Label htmlFor={`enabled-${portal.source}`} className="font-normal">
            <Checkbox
              id={`enabled-${portal.source}`}
              checked={portal.enabled}
              disabled={setEnabled.isPending}
              onCheckedChange={(checked) => setEnabled.mutate(checked === true)}
            />
            Incluir en mis búsquedas
          </Label>
        )}
      </header>

      {portal.available &&
        (portal.status === 'connected' ? (
          <Connected portal={portal} />
        ) : (
          <MagicLinkSteps portal={portal} />
        ))}
    </article>
  );
}

function Connected({ portal }: { portal: PortalAccount }) {
  const check = useCheckPortal(portal.source);
  const disconnect = useDisconnectPortal(portal.source);

  function handleDisconnect() {
    if (window.confirm(`¿Desconectar ${portal.name}? Se borra la sesión guardada.`))
      disconnect.mutate();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {portal.connectedAt && `Conectado el ${formatDateTime(portal.connectedAt)}. `}
        {portal.checkedAt && `Última comprobación: ${formatDateTime(portal.checkedAt)}.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>
          {check.isPending ? 'Comprobando…' : 'Comprobar conexión'}
        </Button>
        <Button variant="destructive" onClick={handleDisconnect} disabled={disconnect.isPending}>
          Desconectar
        </Button>
      </div>
      {(check.error ?? disconnect.error) && (
        <p role="alert" className="text-sm text-destructive">
          {(check.error ?? disconnect.error)?.message}
        </p>
      )}
    </div>
  );
}

/** Conexión por enlace mágico: el usuario lo pide en el portal y lo pega aquí. */
function MagicLinkSteps({ portal }: { portal: PortalAccount }) {
  const [link, setLink] = useState('');
  const connect = useConnectPortal(portal.source);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    connect.mutate(link.trim(), { onSuccess: () => setLink('') });
  }

  return (
    <div className="space-y-4">
      {portal.status === 'expired' && (
        <p role="status" className="rounded-lg bg-destacador-suave px-3 py-2 text-sm">
          La sesión venció. Vuelve a conectar tu cuenta para seguir viendo sus ofertas.
        </p>
      )}
      <ol className="list-decimal space-y-3 pl-5 text-sm marker:font-semibold">
        <li className="space-y-2">
          <p>
            Pide tu enlace de ingreso en {portal.name}. Lo pides tú, en tu navegador: Job Finder
            nunca lo solicita por ti.
          </p>
          {portal.loginUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={portal.loginUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                Abrir {portal.name}
              </a>
            </Button>
          )}
        </li>
        <li>
          Cuando lo tengas, <strong>no lo abras</strong>: sirve una sola vez. Copia su dirección
          completa.
        </li>
        <li className="space-y-2">
          <p>Pégalo aquí. Lo usamos una sola vez y no lo guardamos.</p>
          <form className="flex flex-wrap gap-2" onSubmit={handleSubmit}>
            <Input
              type="password"
              autoComplete="off"
              aria-label={`Enlace de ingreso de ${portal.name}`}
              placeholder="https://…"
              className="max-w-md flex-1"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
            <Button type="submit" disabled={!link.trim() || connect.isPending}>
              {connect.isPending ? 'Conectando…' : 'Conectar'}
            </Button>
          </form>
        </li>
      </ol>
      {connect.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Abriendo el enlace en el servidor. Toma unos segundos.
        </p>
      )}
      {connect.isError && (
        <p role="alert" className="text-sm text-destructive">
          {connect.error.message}
        </p>
      )}
    </div>
  );
}
