import {
  DEFAULT_JOB_PREFERENCES,
  EMPTY_PROFILE_DATA,
  type Profile,
  type ProfileData,
  type ProfileDraft,
  type SessionUser,
} from '@job-finder/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp } from '@/test/render';

const USER: SessionUser = {
  id: 1,
  email: 'camila@example.com',
  name: 'Camila',
  llmProvider: 'claude-cli',
};
const CV = { filename: 'cv.pdf', sizeBytes: 34_000, pages: 1, uploadedAt: '2026-10-09T20:00:00Z' };
const DATA: ProfileData = {
  ...EMPTY_PROFILE_DATA,
  fullName: 'Camila Rojas',
  headline: 'Ingeniera Civil Biomédica',
  contact: { ...EMPTY_PROFILE_DATA.contact, email: 'camila@example.com' },
  experience: [
    {
      kind: 'job',
      title: 'Ingeniera de Equipos Médicos',
      company: 'Hospital Ejemplo',
      start: '2024-03',
      end: null,
      highlights: ['Mantenimiento preventivo'],
    },
  ],
};
const EMPTY: Profile = {
  cv: null,
  data: null,
  preferences: DEFAULT_JOB_PREFERENCES,
  confirmedAt: null,
  draft: null,
  generated: null,
};

function withDraft(draft: Partial<ProfileDraft>, profile: Partial<Profile> = {}): Profile {
  return {
    ...EMPTY,
    cv: CV,
    ...profile,
    draft: {
      source: 'cv',
      step: 1,
      data: DATA,
      preferences: DEFAULT_JOB_PREFERENCES,
      recommendations: [],
      updatedAt: '2026-10-09T20:01:00Z',
      ...draft,
    },
  };
}

const CONFIRMED: Profile = { ...EMPTY, cv: CV, data: DATA, confirmedAt: '2026-10-09T20:05:00Z' };
const me = { 'GET /api/auth/me': { status: 200, body: USER } };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Mi perfil: inicio', () => {
  it('la primera vez ofrece empezar con el CV o a mano', async () => {
    mockApi({ ...me, 'GET /api/profile': { status: 200, body: EMPTY } });
    renderApp('/perfil');

    expect(await screen.findByRole('heading', { name: 'Arma tu perfil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir CV' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Completar a mano' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('al subir el CV, la IA lo lee y abre el wizard prellenado y marcado', async () => {
    const fetchMock = mockApi({
      ...me,
      'GET /api/profile': { status: 200, body: EMPTY },
      'POST /api/profile/cv': { status: 200, body: { ...EMPTY, cv: CV } },
      'POST /api/profile/draft/from-cv': { status: 200, body: withDraft({}) },
    });
    renderApp('/perfil');

    await userEvent.upload(
      await screen.findByLabelText('Archivo del CV'),
      new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByRole('heading', { name: 'Datos básicos' })).toBeInTheDocument();
    const name = screen.getByLabelText('Nombre');
    expect(name).toHaveValue('Camila Rojas');
    expect(name.closest('.ai-prefilled')).not.toBeNull();
    const calls = fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${url}`);
    expect(calls).toEqual(
      expect.arrayContaining(['POST /api/profile/cv', 'POST /api/profile/draft/from-cv']),
    );
  });

  it('si la IA falla, permite reintentar sin volver a subir el CV', async () => {
    mockApi({
      ...me,
      'GET /api/profile': { status: 200, body: EMPTY },
      'POST /api/profile/cv': { status: 200, body: { ...EMPTY, cv: CV } },
      'POST /api/profile/draft/from-cv': {
        status: 400,
        body: { message: 'El CLI de Claude no tiene sesión en el servidor' },
      },
    });
    renderApp('/perfil');

    await userEvent.upload(
      await screen.findByLabelText('Archivo del CV'),
      new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('no tiene sesión');
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument();
  });
});

describe('Mi perfil: wizard', () => {
  it('muestra la sugerencia de la IA en su paso y la guarda resuelta al avanzar', async () => {
    let sent: ProfileDraft | undefined;
    mockApi({
      ...me,
      'GET /api/profile': {
        status: 200,
        body: withDraft({
          recommendations: [{ section: 'basics', text: 'Agrega un resumen breve.' }],
        }),
      },
      'PUT /api/profile/draft': (body) => {
        sent = body as ProfileDraft;
        return { status: 200, body: withDraft(sent) };
      },
    });
    renderApp('/perfil');

    expect(await screen.findByText('Agrega un resumen breve.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByText('Agrega un resumen breve.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByRole('heading', { name: 'Contacto y enlaces' })).toBeInTheDocument();
    expect(sent).toMatchObject({ step: 2, recommendations: [], data: DATA });
  });

  it('no avanza si el paso tiene errores', async () => {
    const fetchMock = mockApi({
      ...me,
      'GET /api/profile': { status: 200, body: withDraft({ step: 2 }) },
    });
    renderApp('/perfil');

    const email = await screen.findByLabelText('Correo');
    await userEvent.clear(email);
    await userEvent.type(email, 'no-es-correo');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Correo inválido')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('guarda los dealbreakers escritos con tus palabras', async () => {
    let sent: ProfileDraft | undefined;
    mockApi({
      ...me,
      'GET /api/profile': { status: 200, body: withDraft({ step: 8 }) },
      'PUT /api/profile/draft': (body) => {
        sent = body as ProfileDraft;
        return { status: 200, body: withDraft(sent) };
      },
    });
    renderApp('/perfil');

    expect(await screen.findByRole('heading', { name: 'Qué buscas' })).toBeInTheDocument();
    // Las preferencias no las completa la IA: no hay aviso de destacador.
    expect(screen.queryByText(/marcado en amarillo/)).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText('Lo que descartaría una oferta'),
      'Que implique conducir{enter}Turnos de noche',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByRole('heading', { name: 'Revisión' })).toBeInTheDocument();
    expect(sent?.preferences.dealbreakers).toEqual(['Que implique conducir', 'Turnos de noche']);
  });

  it('en la revisión muestra el perfil que lee la IA y al confirmar queda listo', async () => {
    let confirmed = false;
    mockApi({
      ...me,
      'GET /api/profile': { status: 200, body: withDraft({ step: 9 }) },
      'PUT /api/profile/draft': (body) => ({ status: 200, body: withDraft(body as ProfileDraft) }),
      'POST /api/profile/draft/confirm': () => {
        confirmed = true;
        return { status: 200, body: CONFIRMED };
      },
    });
    renderApp('/perfil');

    expect(await screen.findByRole('heading', { name: 'Camila Rojas' })).toBeInTheDocument();
    expect(screen.getByText('Para postular. No se envía a la IA.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar perfil' }));

    expect(await screen.findByRole('button', { name: 'Editar perfil' })).toBeInTheDocument();
    expect(confirmed).toBe(true);
  });

  it('descartar los cambios pide confirmación', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = mockApi({
      ...me,
      'GET /api/profile': { status: 200, body: withDraft({}, { data: DATA }) },
      'DELETE /api/profile/draft': { status: 200, body: CONFIRMED },
    });
    renderApp('/perfil');

    await userEvent.click(await screen.findByRole('button', { name: 'Descartar cambios' }));

    expect(await screen.findByRole('button', { name: 'Editar perfil' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
  });
});

describe('Mi perfil: confirmado', () => {
  it('muestra el perfil y permite editarlo a mano recorriendo el wizard', async () => {
    mockApi({
      ...me,
      'GET /api/profile': { status: 200, body: CONFIRMED },
      'POST /api/profile/draft': {
        status: 200,
        body: withDraft({ source: 'manual' }, { data: DATA }),
      },
    });
    renderApp('/perfil');

    expect(await screen.findByRole('heading', { name: 'Camila Rojas' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    expect(screen.getByRole('heading', { name: 'Editar tu perfil' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar manualmente' }));

    expect(await screen.findByRole('heading', { name: 'Datos básicos' })).toBeInTheDocument();
    // Sin CV nuevo no hay nada prellenado por la IA.
    expect(screen.getByLabelText('Nombre').closest('.ai-prefilled')).toBeNull();
  });

  it('al descartar la edición vuelve a mostrar el perfil', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApi({
      ...me,
      'GET /api/profile': { status: 200, body: CONFIRMED },
      'POST /api/profile/draft': {
        status: 200,
        body: withDraft({ source: 'manual' }, { data: DATA }),
      },
      'DELETE /api/profile/draft': { status: 200, body: CONFIRMED },
    });
    renderApp('/perfil');

    await userEvent.click(await screen.findByRole('button', { name: 'Editar perfil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar manualmente' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Descartar cambios' }));

    expect(await screen.findByRole('button', { name: 'Editar perfil' })).toBeInTheDocument();
  });
});
