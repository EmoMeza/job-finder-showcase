import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { SESSION_QUERY_KEY } from '@/lib/auth';

export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      // Si cualquier request responde 401 (sesión expirada), se marca la sesión como cerrada
      // y RequireAuth redirige al login.
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          queryClient.setQueryData(SESSION_QUERY_KEY, null);
        }
      },
    }),
  });
  return queryClient;
}
