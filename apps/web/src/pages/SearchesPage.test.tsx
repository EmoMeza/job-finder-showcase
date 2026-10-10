import type { PortalSearch, SearchRun, SessionUser } from '@job-finder/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp } from '@/test/render';

const USER: SessionUser = {
  id: 1,
  email: 'camila@example.com',
  name: 'Camila',
  llmProvider: 'claude-cli',
};
const RUN: SearchRun = {
  id: 3,
  trigger: 'manual',
  status: 'success',
  step: null,
  startedAt: '2026-10-10T03:00:00Z',
  finishedAt: '2026-10-10T03:01:00Z',
  found: 25,
  added: 4,
  reachedEnd: false,
  warnings: [],
  error: null,
  artifacts: [],
};
const SEARCH: PortalSearch = {
  source: 'demo',
  name: 'Empleos Demo',
  portalStatus: 'connected',
  enabled: true,
  conditionsManagedIn: 'portal',
  conditionsUrl: 'http://localhost:4100/para-ti',
  conditions: null,
  conditionsReadAt: null,
  intervalHours: null,
  lastRun: null,
};
const SEARCHED: PortalSearch = {
  ...SEARCH,
  conditions: [
    { label: 'Categorías', values: ['Programación', 'Data Science / Analytics'] },
    { label: 'Sueldo mínimo', values: ['USD 1600 al mes'] },
  ],
  conditionsReadAt: '2026-10-10T03:01:00Z',
  lastRun: RUN,
};
const base = {
  'GET /api/auth/me': { status: 200, body: USER },
  'GET /api/searches/demo/runs': { status: 200, body: [] },
};
const card = async () => within(await screen.findByRole('article', { name: 'Empleos Demo' }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Búsquedas', () => {
  it('sin conectar el portal, lleva a conectarlo y no deja buscar', async () => {
    mockApi({
      ...base,
      'GET /api/searches': { status: 200, body: [{ ...SEARCH, portalStatus: 'disconnected' }] },
    });
    renderApp('/busquedas');

    const demo = await card();
    expect(demo.getByRole('link', { name: 'Conectar Empleos Demo' })).toHaveAttribute(
      'href',
      '/configuracion',
    );
    expect(demo.queryByRole('button', { name: 'Buscar ahora' })).not.toBeInTheDocument();
  });

  it('antes de la primera búsqueda explica de dónde salen las condiciones', async () => {
    mockApi({ ...base, 'GET /api/searches': { status: 200, body: [SEARCH] } });
    renderApp('/busquedas');

    const demo = await card();
    expect(demo.getByText('Se leen de tu cuenta la primera vez que buscas.')).toBeInTheDocument();
    expect(demo.getByRole('link', { name: /Cambiarlas en Empleos Demo/ })).toHaveAttribute(
      'href',
      SEARCH.conditionsUrl,
    );
  });

  it('muestra las condiciones leídas del portal, el último resultado y el historial', async () => {
    mockApi({
      ...base,
      'GET /api/searches': { status: 200, body: [SEARCHED] },
      'GET /api/searches/demo/runs': { status: 200, body: [RUN] },
    });
    renderApp('/busquedas');

    const demo = await card();
    const conditions = within(demo.getByRole('region', { name: 'Condiciones de búsqueda' }));
    expect(conditions.getByText('Programación, Data Science / Analytics')).toBeInTheDocument();
    expect(conditions.getByText('USD 1600 al mes')).toBeInTheDocument();
    expect(demo.getByText('4 ofertas nuevas')).toBeInTheDocument();

    const history = within(await demo.findByRole('region', { name: 'Últimas búsquedas' }));
    expect(history.getByText('Manual')).toBeInTheDocument();
    expect(history.getByText('Lista')).toBeInTheDocument();
    expect(
      history.getByText('Quedaron ofertas más antiguas sin leer en el portal.'),
    ).toBeInTheDocument();
  });

  it('"Buscar ahora" lanza la búsqueda y muestra su avance', async () => {
    const running: SearchRun = {
      ...RUN,
      status: 'running',
      step: 'Leyendo las ofertas',
      finishedAt: null,
      found: 0,
      added: 0,
      reachedEnd: null,
    };
    let started = false;
    const fetchMock = mockApi({
      ...base,
      'GET /api/searches': () => ({
        status: 200,
        body: [started ? { ...SEARCH, lastRun: running } : SEARCH],
      }),
      'POST /api/searches/demo/run': () => {
        started = true;
        return { status: 202, body: running };
      },
    });
    renderApp('/busquedas');

    const demo = await card();
    await userEvent.click(demo.getByRole('button', { name: 'Buscar ahora' }));

    expect(await demo.findByRole('status')).toHaveTextContent('Leyendo las ofertas…');
    expect(demo.getByRole('button', { name: 'Buscando…' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/searches/demo/run',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('una búsqueda fallida muestra el error y las capturas', async () => {
    const failed: SearchRun = {
      ...RUN,
      status: 'failed',
      found: 0,
      added: 0,
      reachedEnd: null,
      error: 'Empleos Demo respondió el feed con un formato que no reconozco.',
      artifacts: ['feed.png', 'feed.html'],
    };
    mockApi({
      ...base,
      'GET /api/searches': { status: 200, body: [{ ...SEARCH, lastRun: failed }] },
    });
    renderApp('/busquedas');

    const alert = within(await (await card()).findByRole('alert'));
    expect(alert.getByText('La última búsqueda falló')).toBeInTheDocument();
    expect(alert.getByText(failed.error!)).toBeInTheDocument();
    expect(alert.getByRole('link', { name: 'Captura de la página' })).toHaveAttribute(
      'href',
      '/api/searches/runs/3/artifacts/feed.png',
    );
  });

  it('guarda cada cuánto se repite la búsqueda', async () => {
    let sent: unknown;
    mockApi({
      ...base,
      'GET /api/searches': { status: 200, body: [SEARCH] },
      'PUT /api/searches/demo': (body) => {
        sent = body;
        return { status: 200, body: { ...SEARCH, intervalHours: 12 } };
      },
    });
    renderApp('/busquedas');

    const demo = await card();
    const select = demo.getByRole('combobox', { name: 'Repetir la búsqueda' });
    await userEvent.selectOptions(select, 'Cada 12 horas');

    expect(sent).toEqual({ intervalHours: 12 });
    await waitFor(() => expect(select).toHaveValue('12'));
  });
});
