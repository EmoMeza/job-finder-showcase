import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE_DATA, type ProfileData } from './profile.js';
import { buildProfileMarkdown, formatCvDate } from './profile-markdown.js';

const DATA: ProfileData = {
  ...EMPTY_PROFILE_DATA,
  fullName: 'Camila Rojas',
  headline: 'Ingeniera Civil Biomédica',
  careerLevel: 'junior',
  yearsOfExperience: 2,
  experience: [
    {
      kind: 'job',
      title: 'Ingeniera de Equipos Médicos',
      company: 'Hospital Ejemplo',
      start: '2024-03',
      end: null,
      highlights: ['Mantenimiento preventivo de ventiladores'],
    },
    {
      kind: 'volunteer',
      title: 'Coordinadora',
      company: 'Fundación Ejemplo',
      start: '2021',
      end: '2022',
      highlights: [],
    },
  ],
  skills: [{ name: 'Equipamiento médico', items: ['Ventiladores mecánicos', 'Monitores'] }],
  education: [
    {
      degree: 'Ingeniería Civil Biomédica',
      institution: 'U. de Ejemplo',
      start: '2016',
      end: '2022',
      status: 'graduated',
    },
  ],
  languages: [{ language: 'Inglés', level: 'intermedio' }],
  additionalInfo: 'Licencia de conducir clase B.',
};

describe('buildProfileMarkdown', () => {
  it('arma las secciones con los datos estructurados', () => {
    const markdown = buildProfileMarkdown(DATA);
    expect(markdown).toContain('# Camila Rojas');
    expect(markdown).toContain('Nivel: Junior · 2 años de experiencia');
    expect(markdown).toContain(
      '### Ingeniera de Equipos Médicos — Hospital Ejemplo (mar 2024 – actualidad)',
    );
    expect(markdown).toContain('- **Equipamiento médico:** Ventiladores mecánicos, Monitores');
    expect(markdown).toContain('(2016 – 2022) · Egresado (sin título)');
    expect(markdown).toContain('## Comentarios adicionales\nLicencia de conducir clase B.');
  });

  it('separa el voluntariado de la experiencia laboral', () => {
    const markdown = buildProfileMarkdown(DATA);
    const laboral = markdown.indexOf('## Experiencia laboral');
    const voluntariado = markdown.indexOf('## Voluntariado');
    expect(laboral).toBeGreaterThan(-1);
    expect(voluntariado).toBeGreaterThan(laboral);
    expect(markdown.slice(voluntariado)).toContain(
      'Coordinadora — Fundación Ejemplo (2021 – 2022)',
    );
    expect(markdown).not.toContain('## Prácticas');
  });

  it('no incluye los datos de contacto', () => {
    const markdown = buildProfileMarkdown({
      ...DATA,
      contact: {
        email: 'camila@example.com',
        phone: '+56 9 1234 5678',
        linkedin: 'https://linkedin.com/in/camila',
        github: null,
        links: [{ label: 'Portafolio', url: 'https://example.com' }],
      },
    });
    expect(markdown).not.toContain('camila@example.com');
    expect(markdown).not.toContain('linkedin');
    expect(markdown).not.toContain('Portafolio');
  });

  it('es determinístico', () => {
    expect(buildProfileMarkdown(DATA)).toBe(buildProfileMarkdown(structuredClone(DATA)));
  });

  it('funciona con un perfil vacío', () => {
    expect(buildProfileMarkdown(EMPTY_PROFILE_DATA)).toBe('# Perfil profesional\n');
  });
});

describe('formatCvDate', () => {
  it('formatea año y mes en español', () => {
    expect(formatCvDate('2022-03')).toBe('mar 2022');
    expect(formatCvDate('2019')).toBe('2019');
  });
});
