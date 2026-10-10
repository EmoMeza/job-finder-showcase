import type { PortalSearch, SearchIntervalHours, SearchRun, SourceId } from '@job-finder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { JOBS_KEY } from '@/lib/jobs';

const SEARCHES_KEY = ['searches'] as const;
const runsKey = (source: SourceId) => ['searches', source, 'runs'] as const;

/** Mientras una búsqueda corre, se vuelve a consultar cada tanto para mostrar su avance. */
const LIVE_REFRESH_MS = 2000;

export const isRunning = (search: PortalSearch) => search.lastRun?.status === 'running';

export function useSearches() {
  return useQuery({
    queryKey: SEARCHES_KEY,
    queryFn: () => apiGet<PortalSearch[]>('/searches'),
    refetchInterval: (query) => (query.state.data?.some(isRunning) ? LIVE_REFRESH_MS : false),
  });
}

export function useSearchRuns(source: SourceId, live: boolean) {
  return useQuery({
    queryKey: runsKey(source),
    queryFn: () => apiGet<SearchRun[]>(`/searches/${source}/runs`),
    refetchInterval: live ? LIVE_REFRESH_MS : false,
  });
}

/** Lanza la búsqueda. Responde de inmediato: el avance llega con las consultas siguientes. */
export function useRunSearch(source: SourceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<SearchRun>(`/searches/${source}/run`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SEARCHES_KEY }),
  });
}

export function useSetSearchInterval(source: SourceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (intervalHours: SearchIntervalHours | null) =>
      apiPut<PortalSearch>(`/searches/${source}`, { intervalHours }),
    onSuccess: (updated) =>
      queryClient.setQueryData<PortalSearch[]>(SEARCHES_KEY, (searches) =>
        searches?.map((search) => (search.source === updated.source ? updated : search)),
      ),
  });
}

/** Al terminar una búsqueda cambian su historial y la lista de ofertas. */
export function useRefreshAfterRun(source: SourceId) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: runsKey(source) });
    void queryClient.invalidateQueries({ queryKey: JOBS_KEY });
  }, [queryClient, source]);
}

export const artifactUrl = (runId: number, name: string) =>
  `/api/searches/runs/${runId}/artifacts/${encodeURIComponent(name)}`;
