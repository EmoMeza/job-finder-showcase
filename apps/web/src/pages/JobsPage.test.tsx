import type { JobSummary, SessionUser } from '@job-finder/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp } from '@/test/render';

const USER: SessionUser = {
  id: 1,
  email: 'camila@example.com',
  name: 'Camila',
  llmProvider: 'claude-cli',
};
const JOB: JobSummary = {
  id: 7,
  source: 'demo',
  url: 'http://localhost:4100/ofertas/analista-de-datos-acme-7',
  title: 'Analista de datos',
  company: 'Acme',
  location: 'Santiago (Chile)',
  modality: 'hybrid',
  employmentType: 'full-time',
  seniority: 'Semi Senior',
  salary: { min: 1900, max: 2600, currency: 'USD', period: 'month', basis: 'gross', public: false },
  publishedOn: '2026-10-09',
  status: 'new',
  foundAt: '2026-10-10T03:00:00Z',
};
const base = { 'GET /api/auth/me': { status: 200, body: USER } };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Ofertas', () => {
  it('lista las ofertas con sus datos y el enlace al portal', async () => {
    const remote: JobSummary = {
      ...JOB,
      id: 8,
      title: 'QA Automation',
      company: null,
      modality: 'remote',
      salary: null,
      publishedOn: null,
    };
    mockApi({ ...base, 'GET /api/jobs': { status: 200, body: [JOB, remote] } });
    renderApp('/ofertas');

    const row = within(await screen.findByRole('row', { name: /Analista de datos/ }));
    expect(row.getByRole('link', { name: /Analista de datos/ })).toHaveAttribute('href', JOB.url);
    expect(row.getByText('Acme, en Empleos Demo')).toBeInTheDocument();
    expect(row.getByText('Semi Senior')).toBeInTheDocument();
    expect(row.getByText('Jornada completa')).toBeInTheDocument();
    expect(row.getByText('Híbrido')).toBeInTheDocument();
    expect(row.getByText('USD 1.900 – 2.600 al mes')).toBeInTheDocument();
    expect(row.getByText('La empresa no lo publica')).toBeInTheDocument();
    expect(row.getByText(/9 oct/)).toBeInTheDocument();

    const other = within(screen.getByRole('row', { name: /QA Automation/ }));
    expect(other.getByText('Empresa sin informar, en Empleos Demo')).toBeInTheDocument();
    expect(other.getByText('Remoto')).toBeInTheDocument();
    expect(other.getByText('Sin fecha')).toBeInTheDocument();
    expect(screen.getByText(/2 ofertas encontradas/)).toBeInTheDocument();
  });

  it('sin ofertas, invita a buscar', async () => {
    mockApi({ ...base, 'GET /api/jobs': { status: 200, body: [] } });
    renderApp('/ofertas');

    expect(await screen.findByText('Todavía no hay ofertas.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Búsquedas' })).toHaveAttribute(
      'href',
      '/busquedas',
    );
  });

  it('avisa si no se pudieron cargar', async () => {
    mockApi({ ...base, 'GET /api/jobs': { status: 500 } });
    renderApp('/ofertas');

    expect(await screen.findByText('No se pudieron cargar las ofertas.')).toBeInTheDocument();
  });
});
