import type { LoginRequest, SessionUser } from '@job-finder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiPost } from '@/lib/api';

export const SESSION_QUERY_KEY = ['session'] as const;

/** Usuario con sesión iniciada, o `null` si no hay sesión. */
export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async (): Promise<SessionUser | null> => {
      try {
        return await apiGet<SessionUser>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginRequest) => apiPost<SessionUser>('/auth/login', credentials),
    onSuccess: (user) => queryClient.setQueryData(SESSION_QUERY_KEY, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout'),
    onSuccess: () => {
      // Primero se marca la sesión como cerrada (RequireAuth redirige al login) y después se
      // borra lo cacheado del usuario anterior. `clear()` desconectaría también a los componentes
      // que observan la sesión y no se enterarían del cambio.
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
      });
    },
  });
}
