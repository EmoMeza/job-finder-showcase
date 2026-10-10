import type { LlmSettings, SessionUser } from '@job-finder/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderApp } from '@/test/render';

const USER: SessionUser = {
  id: 1,
  email: 'emo@example.com',
  name: 'Emo',
  llmProvider: 'claude-cli',
};
const DEFAULT_SETTINGS: LlmSettings = {
  provider: 'claude-cli',
  apiKeyHint: null,
  cliAvailable: true,
};

const baseRoutes = {
  'GET /api/auth/me': { status: 200, body: USER },
  'GET /api/portals': { status: 200, body: [] },
};

describe('Configuración de IA', () => {
  it('muestra el proveedor actual', async () => {
    mockApi({ ...baseRoutes, 'GET /api/settings/llm': { status: 200, body: DEFAULT_SETTINGS } });
    renderApp('/configuracion');

    expect(await screen.findByRole('radio', { name: /línea de comandos/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /API key/ })).not.toBeChecked();
  });

  it('muestra el error de la API al elegir la API sin key', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/settings/llm': { status: 200, body: DEFAULT_SETTINGS },
      'PUT /api/settings/llm': {
        status: 400,
        body: { message: 'Para usar la API de Anthropic hay que ingresar una API key' },
      },
    });
    renderApp('/configuracion');

    await userEvent.click(await screen.findByRole('radio', { name: /API key/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('hay que ingresar una API key');
  });

  it('guarda la API key y después solo muestra sus últimos caracteres', async () => {
    let sentBody: unknown;
    mockApi({
      ...baseRoutes,
      'GET /api/settings/llm': { status: 200, body: DEFAULT_SETTINGS },
      'PUT /api/settings/llm': (body) => {
        sentBody = body;
        return {
          status: 200,
          body: { provider: 'anthropic-api', apiKeyHint: 'WXYZ', cliAvailable: true },
        };
      },
    });
    renderApp('/configuracion');

    await userEvent.click(await screen.findByRole('radio', { name: /API key/ }));
    await userEvent.type(screen.getByLabelText('API key de Anthropic'), 'sk-ant-api03-clave-WXYZ');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('••••WXYZ')).toBeInTheDocument();
    expect(sentBody).toEqual({ provider: 'anthropic-api', apiKey: 'sk-ant-api03-clave-WXYZ' });
    expect(screen.getByLabelText('API key de Anthropic')).toHaveValue('');
  });

  it('prueba la conexión y muestra el modelo', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/settings/llm': { status: 200, body: DEFAULT_SETTINGS },
      'POST /api/settings/llm/test': {
        status: 201,
        body: { provider: 'claude-cli', model: 'claude-opus-5-5', durationMs: 3900 },
      },
    });
    renderApp('/configuracion');

    await userEvent.click(await screen.findByRole('button', { name: 'Probar conexión' }));

    expect(await screen.findByText(/Conexión correcta/)).toHaveTextContent(
      'claude-opus-5-5 en 3.9 s',
    );
  });

  it('muestra cómo resolver un error de conexión', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/settings/llm': { status: 200, body: DEFAULT_SETTINGS },
      'POST /api/settings/llm/test': {
        status: 400,
        body: {
          message:
            'El CLI de Claude no tiene sesión en el servidor: configura CLAUDE_CODE_OAUTH_TOKEN',
        },
      },
    });
    renderApp('/configuracion');

    await userEvent.click(await screen.findByRole('button', { name: 'Probar conexión' }));

    expect(await screen.findByText(/CLAUDE_CODE_OAUTH_TOKEN/)).toBeInTheDocument();
  });
});
