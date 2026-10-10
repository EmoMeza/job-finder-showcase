import { CV_MAX_BYTES, type Profile } from '@job-finder/shared';
import { FileText, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useDraftFromCv, useStartManualDraft, useUploadCv } from '@/lib/profile';
import { CvFileButton } from './CvFileButton';

function Option(props: { icon: ReactNode; title: string; children: ReactNode; action: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-linea-suave bg-card p-6">
      <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
        {props.icon}
      </div>
      <div className="flex-1 space-y-1">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        <p className="text-muted-foreground">{props.children}</p>
      </div>
      <div className="flex flex-wrap gap-2">{props.action}</div>
    </section>
  );
}

/**
 * Inicio del wizard: con un CV (la IA prellena el perfil) o a mano. Sirve para armar el perfil
 * la primera vez y para editarlo después.
 */
export function CvStart({ profile, onCancel }: { profile: Profile; onCancel?: () => void }) {
  const upload = useUploadCv();
  const fromCv = useDraftFromCv();
  const manual = useStartManualDraft();
  const editing = profile.data !== null;

  const handleFile = (file: File) => upload.mutate(file, { onSuccess: () => fromCv.mutate() });

  if (upload.isPending || fromCv.isPending) {
    return (
      <div
        role="status"
        className="mx-auto max-w-xl space-y-2 rounded-xl border border-linea-suave bg-card p-10 text-center"
      >
        <FileText className="mx-auto size-10 animate-pulse text-primary" />
        <p className="text-lg font-semibold">
          {upload.isPending ? 'Subiendo tu CV…' : 'Leyendo tu CV…'}
        </p>
        <p className="text-muted-foreground">
          {upload.isPending ? '' : 'La IA está armando tu perfil. Toma unos segundos.'}
        </p>
      </div>
    );
  }

  const error = upload.error ?? fromCv.error ?? manual.error;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {editing ? 'Editar tu perfil' : 'Arma tu perfil'}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Tu perfil es lo que lee la IA para evaluar qué tan bien calzas con cada oferta. Te guiamos
          paso a paso; al final revisas el resultado y lo confirmas.
        </p>
      </header>

      {error && (
        <div role="alert" className="space-y-2 rounded-xl border border-destructive/40 bg-card p-4">
          <p className="text-destructive">{error.message}</p>
          {fromCv.isError && profile.cv && (
            <Button variant="outline" onClick={() => fromCv.mutate()}>
              Intentar de nuevo
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Option
          icon={<FileText className="size-5" />}
          title={editing ? 'Actualizar con un CV nuevo' : 'Empezar con tu CV'}
          action={
            <>
              <CvFileButton label="Subir CV" onFile={handleFile} />
              {profile.cv && (
                <Button variant="ghost" onClick={() => fromCv.mutate()}>
                  Usar {profile.cv.filename}
                </Button>
              )}
            </>
          }
        >
          Sube tu CV en PDF (hasta {CV_MAX_BYTES / 1024 / 1024} MB) y lo leemos para prellenar cada
          parte.
          {editing && ' Reemplaza los datos de tu perfil actual.'}
        </Option>
        <Option
          icon={<PencilLine className="size-5" />}
          title={editing ? 'Editar sin CV nuevo' : 'Empezar sin CV'}
          action={
            <Button variant="outline" onClick={() => manual.mutate()} disabled={manual.isPending}>
              {editing ? 'Editar manualmente' : 'Completar a mano'}
            </Button>
          }
        >
          {editing
            ? 'Recorre los pasos con tu perfil actual y cambia lo que necesites.'
            : 'Completa cada parte tú mismo. Puedes subir tu CV más adelante.'}
        </Option>
      </div>

      {onCancel && (
        <Button variant="ghost" onClick={onCancel}>
          Volver a mi perfil
        </Button>
      )}
    </div>
  );
}
