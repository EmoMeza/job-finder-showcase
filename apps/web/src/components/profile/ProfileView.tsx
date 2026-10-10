import type { Profile, ProfileData } from '@job-finder/shared';
import { Download, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/profile';
import { ProfileDocument } from './ProfileDocument';
import { ContactSummary, PreferencesSummary } from './ProfileSummaries';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-linea-suave bg-card p-5">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Perfil confirmado: el documento que lee la IA y, al lado, lo demás. */
export function ProfileView({
  profile,
  data,
  onEdit,
}: {
  profile: Profile;
  data: ProfileData;
  onEdit: () => void;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
          <p className="text-muted-foreground">
            Esto es lo que lee la IA para evaluar las ofertas.
            {profile.confirmedAt && ` Confirmado el ${formatDate(profile.confirmedAt)}.`}
          </p>
        </header>
        <ProfileDocument data={data} />
      </div>

      <aside className="space-y-4 lg:pt-[4.5rem]">
        <Button size="lg" className="w-full" onClick={onEdit}>
          <PencilLine />
          Editar perfil
        </Button>
        <Panel title="CV">
          {profile.cv ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium break-words">{profile.cv.filename}</p>
              <p className="text-muted-foreground">
                {profile.cv.pages} {profile.cv.pages === 1 ? 'página' : 'páginas'}, subido el{' '}
                {formatDate(profile.cv.uploadedAt)}
              </p>
              <Button variant="ghost" size="sm" asChild>
                <a href="/api/profile/cv">
                  <Download />
                  Descargar
                </a>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No has subido un CV.</p>
          )}
        </Panel>
        <Panel title="Contacto">
          <ContactSummary contact={data.contact} />
        </Panel>
        <Panel title="Qué buscas">
          <PreferencesSummary preferences={profile.preferences} />
        </Panel>
      </aside>
    </div>
  );
}
