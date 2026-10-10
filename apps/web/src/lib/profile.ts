import type { Profile, ProfileDraft } from '@job-finder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';

const PROFILE_KEY = ['profile'] as const;

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => apiGet<Profile>('/profile') });
}

/** Cada operación devuelve el perfil completo actualizado, que reemplaza el de la caché. */
function useProfileMutation<TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<Profile>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (profile) => queryClient.setQueryData(PROFILE_KEY, profile),
  });
}

export function useUploadCv() {
  return useProfileMutation((file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiPost<Profile>('/profile/cv', form);
  });
}

/** La IA lee el CV y abre el wizard prellenado. */
export function useDraftFromCv() {
  return useProfileMutation(() => apiPost<Profile>('/profile/draft/from-cv'));
}

/** Abre el wizard sin IA: desde el perfil actual, o vacío si no hay. */
export function useStartManualDraft() {
  return useProfileMutation(() => apiPost<Profile>('/profile/draft'));
}

export function useSaveDraft() {
  return useProfileMutation((draft: ProfileDraft) => apiPut<Profile>('/profile/draft', draft));
}

export function useConfirmDraft() {
  return useProfileMutation(() => apiPost<Profile>('/profile/draft/confirm'));
}

export function useDiscardDraft() {
  return useProfileMutation(() => apiDelete<Profile>('/profile/draft'));
}

export { formatDate } from '@/lib/format';
