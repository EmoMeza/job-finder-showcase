import { useState } from 'react';
import { CvStart } from '@/components/profile/CvStart';
import { ProfileView } from '@/components/profile/ProfileView';
import { ProfileWizard } from '@/components/profile/wizard/ProfileWizard';
import { useProfile } from '@/lib/profile';

/**
 * Tres estados: perfil en edición (wizard), perfil confirmado (vista) o sin perfil / eligiendo
 * cómo editar (inicio del wizard).
 */
export function ProfilePage() {
  const profile = useProfile();
  const [choosingEdit, setChoosingEdit] = useState(false);

  // Cuando se abre un borrador, "eligiendo cómo editar" ya cumplió su función: al confirmar o
  // descartar se vuelve a la vista del perfil, no a la elección.
  const hasDraft = Boolean(profile.data?.draft);
  const [hadDraft, setHadDraft] = useState(hasDraft);
  if (hasDraft !== hadDraft) {
    setHadDraft(hasDraft);
    if (hasDraft) setChoosingEdit(false);
  }

  if (profile.isPending) return <p className="text-muted-foreground">Cargando…</p>;
  if (profile.isError) return <p className="text-destructive">No se pudo cargar tu perfil.</p>;

  const { draft, data } = profile.data;
  if (draft) return <ProfileWizard draft={draft} />;
  if (data && !choosingEdit) {
    return <ProfileView profile={profile.data} data={data} onEdit={() => setChoosingEdit(true)} />;
  }
  return (
    <CvStart profile={profile.data} onCancel={data ? () => setChoosingEdit(false) : undefined} />
  );
}
