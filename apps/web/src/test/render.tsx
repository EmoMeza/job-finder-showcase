import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { routes } from '@/routes';

/** Renderiza la app completa (rutas reales) en una URL inicial, sin navegador. */
export function renderApp(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

type FakeRoute = { status: number; body?: unknown };

/** Reemplaza `fetch` por respuestas fijas según "MÉTODO /ruta". Una función recibe el body enviado. */
export function mockApi(
  fakeRoutes: Record<string, FakeRoute | ((requestBody: unknown) => FakeRoute)>,
) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async (url, init) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      const route = fakeRoutes[key];
      if (!route) throw new Error(`Request no esperado en el test: ${key}`);
      const requestBody = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      const { status, body } = typeof route === 'function' ? route(requestBody) : route;
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
