import type { HealthResponse } from '@job-finder/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthResponse>('/health'),
  });

  return (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold">Estado del sistema</h1>
      {health.isPending && <p className="text-muted-foreground">Consultando API…</p>}
      {health.isError && <p className="text-destructive">La API no responde.</p>}
      {health.data && (
        <p>
          API: <strong>{health.data.status}</strong> · Base de datos:{' '}
          <strong>{health.data.database}</strong>
        </p>
      )}
    </section>
  );
}
