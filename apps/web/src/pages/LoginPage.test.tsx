import type { SessionUser } from '@job-finder/shared';
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

describe('Login y rutas protegidas', () => {
  it('redirige al login si no hay sesión', async () => {
    mockApi({ 'GET /api/auth/me': { status: 401, body: { message: 'Sesión inválida' } } });
    const { router } = renderApp('/');

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('muestra el error de la API si las credenciales son incorrectas', async () => {
    mockApi({
      'GET /api/auth/me': { status: 401 },
      'POST /api/auth/login': { status: 401, body: { message: 'Email o contraseña incorrectos' } },
    });
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), USER.email);
    await userEvent.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
  });

  it('después del login vuelve a la página que se quería ver', async () => {
    let loggedIn = false;
    mockApi({
      'GET /api/auth/me': () => (loggedIn ? { status: 200, body: USER } : { status: 401 }),
      'POST /api/auth/login': () => {
        loggedIn = true;
        return { status: 200, body: USER };
      },
      'GET /api/health': { status: 200, body: { status: 'ok', database: 'ok' } },
    });
    const { router } = renderApp('/');

    await userEvent.type(await screen.findByLabelText('Email'), USER.email);
    await userEvent.type(screen.getByLabelText('Contraseña'), 'una-clave-segura');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Estado del sistema')).toBeInTheDocument();
    expect(screen.getByText('Emo')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('cerrar sesión vuelve al login', async () => {
    let loggedIn = true;
    mockApi({
      'GET /api/auth/me': () => (loggedIn ? { status: 200, body: USER } : { status: 401 }),
      'POST /api/auth/logout': () => {
        loggedIn = false;
        return { status: 204 };
      },
      'GET /api/health': { status: 200, body: { status: 'ok', database: 'ok' } },
    });
    const { router } = renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: /Cerrar sesión/ }));

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});
