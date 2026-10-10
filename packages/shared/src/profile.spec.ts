import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOB_PREFERENCES,
  EMPTY_PROFILE_DATA,
  jobPreferencesSchema,
  profileDataSchema,
} from './profile.js';

describe('jobPreferencesSchema', () => {
  it('acepta las preferencias por defecto', () => {
    expect(jobPreferencesSchema.parse(DEFAULT_JOB_PREFERENCES)).toEqual(DEFAULT_JOB_PREFERENCES);
  });

  it('exige al menos una modalidad', () => {
    const result = jobPreferencesSchema.safeParse({ ...DEFAULT_JOB_PREFERENCES, modalities: [] });
    expect(result.success).toBe(false);
  });

  it('limpia espacios y rechaza entradas vacías en las listas', () => {
    expect(
      jobPreferencesSchema.parse({ ...DEFAULT_JOB_PREFERENCES, cities: ['  Concepción '] }).cities,
    ).toEqual(['Concepción']);
    expect(
      jobPreferencesSchema.safeParse({ ...DEFAULT_JOB_PREFERENCES, dealbreakers: ['   '] }).success,
    ).toBe(false);
  });

  it('rechaza un sueldo negativo o con decimales', () => {
    for (const salaryMin of [-1, 1.5]) {
      expect(
        jobPreferencesSchema.safeParse({ ...DEFAULT_JOB_PREFERENCES, salaryMin }).success,
      ).toBe(false);
    }
  });
});

describe('profileDataSchema', () => {
  it('acepta el perfil vacío', () => {
    expect(profileDataSchema.parse(EMPTY_PROFILE_DATA)).toEqual(EMPTY_PROFILE_DATA);
  });

  it('valida el formato de las fechas', () => {
    const experience = {
      kind: 'job',
      title: 'Dev',
      company: 'X',
      start: '2022-13',
      end: null,
      highlights: [],
    };
    const result = profileDataSchema.safeParse({ ...EMPTY_PROFILE_DATA, experience: [experience] });
    expect(result.success).toBe(false);
  });
});

describe('contactSchema', () => {
  it('valida correo y enlaces', () => {
    const contact = EMPTY_PROFILE_DATA.contact;
    expect(
      profileDataSchema.safeParse({
        ...EMPTY_PROFILE_DATA,
        contact: { ...contact, email: 'no-es-correo' },
      }).success,
    ).toBe(false);
    expect(
      profileDataSchema.safeParse({
        ...EMPTY_PROFILE_DATA,
        contact: { ...contact, linkedin: 'linkedin.com/in/x' },
      }).success,
    ).toBe(false);
    expect(
      profileDataSchema.safeParse({
        ...EMPTY_PROFILE_DATA,
        contact: {
          ...contact,
          email: 'a@b.cl',
          links: [{ label: 'Portafolio', url: 'https://drive.google.com/x' }],
        },
      }).success,
    ).toBe(true);
  });
});
