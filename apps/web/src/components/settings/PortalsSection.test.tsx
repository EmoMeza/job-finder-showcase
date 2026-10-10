import type { PortalAccount, SessionUser } from '@job-finder/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp } from '@/test/render';

const USER: SessionUser = {
  id: 1,
  email: 'camila@example.com',
  name: 'Camila',
  llmProvider: 'claude-cli',
};
const DEMO: PortalAccount = {
  source: 'demo',
  name: 'Empleos Demo',
  available: true,
  connectionKind: 'magic-link',
  loginUrl: 'http://localhost:4100/ingresar',
  enabled: true,
  status: 'disconnected',
  connectedAt: null,
  checkedAt: null,
};
const OTRO: PortalAccount = {
  ...DEMO,
  source: 'otro',
  name: 'Otro Portal',
  available: false,
  connectionKind: null,
  loginUrl: null,
};
const CONNECTED: PortalAccount = {
  ...DEMO,
  status: 'connected',
  connectedAt: '2026-10-09T20:00:00Z',
  checkedAt: '2026-10-09T20:00:00Z',
};
const LINK = 'http://localhost:4100/ingresar/enlace?token=abc';

const base = {
  'GET /api/auth/me': { status: 200, body: USER },
  'GET /api/settings/llm': {
    status: 200,
    body: { provider: 'claude-cli', apiKeyHint: null, cliAvailable: true },
  },
};
const card = async (name: string) => within(await screen.findByRole('article', { name }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Configuración: portales', () => {
  it('muestra el estado de cada portal y los que aún no están disponibles', async () => {
    mockApi({ ...base, 'GET /api/portals': { status: 200, body: [DEMO, OTRO] } });
    renderApp('/configuracion');

    const demo = await card('Empleos Demo');
    expect(demo.getByText('Sin conectar')).toBeInTheDocument();
    expect(demo.getByRole('link', { name: /Abrir Empleos Demo/ })).toHaveAttribute(
      'href',
      DEMO.loginUrl,
    );
    const otro = await card('Otro Portal');
    expect(otro.getByText('Próximamente')).toBeInTheDocument();
    expect(otro.queryByRole('button', { name: 'Conectar' })).not.toBeInTheDocument();
  });

  it('conecta pegando el enlace mágico', async () => {
    let sent: unknown;
    mockApi({
      ...base,
      'GET /api/portals': { status: 200, body: [DEMO] },
      'POST /api/portals/demo/connect': (body) => {
        sent = body;
        return { status: 200, body: CONNECTED };
      },
    });
    renderApp('/configuracion');

    const demo = await card('Empleos Demo');
    const input = demo.getByLabelText('Enlace de ingreso de Empleos Demo');
    expect(input).toHaveAttribute('type', 'password'); // el enlace no queda a la vista
    await userEvent.type(input, LINK);
    await userEvent.click(demo.getByRole('button', { name: 'Conectar' }));

    expect(await demo.findByText('Conectado')).toBeInTheDocument();
    expect(sent).toEqual({ link: LINK });
    expect(demo.getByRole('button', { name: 'Comprobar conexión' })).toBeInTheDocument();
  });

  it('muestra el motivo si el enlace no sirve', async () => {
    mockApi({
      ...base,
      'GET /api/portals': { status: 200, body: [DEMO] },
      'POST /api/portals/demo/connect': {
        status: 400,
        body: {
          message:
            'El enlace no inició sesión: puede estar vencido o ya usado. Pide uno nuevo y vuelve a intentar.',
        },
      },
    });
    renderApp('/configuracion');

    const demo = await card('Empleos Demo');
    await userEvent.type(demo.getByLabelText('Enlace de ingreso de Empleos Demo'), LINK);
    await userEvent.click(demo.getByRole('button', { name: 'Conectar' }));

    expect(await demo.findByRole('alert')).toHaveTextContent('Pide uno nuevo');
  });

  it('una sesión vencida pide reconectar', async () => {
    mockApi({
      ...base,
      'GET /api/portals': { status: 200, body: [{ ...DEMO, status: 'expired' }] },
    });
    renderApp('/configuracion');

    const demo = await card('Empleos Demo');
    expect(demo.getByText('Reconectar')).toBeInTheDocument();
    expect(demo.getByText(/La sesión venció/)).toBeInTheDocument();
    expect(demo.getByRole('button', { name: 'Conectar' })).toBeInTheDocument();
  });

  it('desconectar pide confirmación y borra la sesión', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApi({
      ...base,
      'GET /api/portals': { status: 200, body: [CONNECTED] },
      'DELETE /api/portals/demo/session': { status: 200, body: DEMO },
    });
    renderApp('/configuracion');

    const demo = await card('Empleos Demo');
    await userEvent.click(demo.getByRole('button', { name: 'Desconectar' }));

    expect(await demo.findByText('Sin conectar')).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Desconectar Empleos Demo'),
    );
  });

  it('permite dejar de incluir un portal en las búsquedas', async () => {
    let sent: unknown;
    mockApi({
      ...base,
      'GET /api/portals': { status: 200, body: [CONNECTED] },
      'PUT /api/portals/demo': (body) => {
        sent = body;
        return { status: 200, body: { ...CONNECTED, enabled: false } };
      },
    });
    renderApp('/configuracion');

    const demo = await card('Empleos Demo');
    await userEvent.click(demo.getByRole('checkbox', { name: 'Incluir en mis búsquedas' }));

    expect(sent).toEqual({ enabled: false });
    expect(
      await demo.findByRole('checkbox', { name: 'Incluir en mis búsquedas' }),
    ).not.toBeChecked();
  });
});
