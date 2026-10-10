import type { PortalAccount, SourceId } from '@job-finder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';

const PORTALS_KEY = ['portals'] as const;

export function usePortals() {
  return useQuery({ queryKey: PORTALS_KEY, queryFn: () => apiGet<PortalAccount[]>('/portals') });
}

/** Cada operación devuelve el portal actualizado, que reemplaza al de la lista en caché. */
function usePortalMutation<TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<PortalAccount>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (updated) =>
      queryClient.setQueryData<PortalAccount[]>(PORTALS_KEY, (portals) =>
        portals?.map((portal) => (portal.source === updated.source ? updated : portal)),
      ),
  });
}

export function useSetPortalEnabled(source: SourceId) {
  return usePortalMutation((enabled: boolean) =>
    apiPut<PortalAccount>(`/portals/${source}`, { enabled }),
  );
}

export function useConnectPortal(source: SourceId) {
  return usePortalMutation((link: string) =>
    apiPost<PortalAccount>(`/portals/${source}/connect`, { link }),
  );
}

export function useCheckPortal(source: SourceId) {
  return usePortalMutation(() => apiPost<PortalAccount>(`/portals/${source}/check`));
}

export function useDisconnectPortal(source: SourceId) {
  return usePortalMutation(() => apiDelete<PortalAccount>(`/portals/${source}/session`));
}
