import { z } from 'zod';
import type { LlmProvider } from './llm.js';
import { JOB_MODALITIES } from './sources.js';

export const CV_MAX_BYTES = 10 * 1024 * 1024;

export const SALARY_CURRENCIES = ['CLP', 'USD'] as const;
export const SALARY_PERIODS = ['month', 'year'] as const;
/** En Chile las ofertas pueden publicar sueldo líquido (neto) o bruto. */
export const SALARY_BASES = ['net', 'gross'] as const;

export const SALARY_PERIOD_LABELS: Record<(typeof SALARY_PERIODS)[number], string> = {
  month: 'mensual',
  year: 'anual',
};

export const SALARY_BASIS_LABELS: Record<(typeof SALARY_BASES)[number], string> = {
  net: 'líquido',
  gross: 'bruto',
};

const listOfShortTexts = (max: number, itemMax: number) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max);

/** Preferencias estructuradas: alimentan el pre-filtro determinístico y el contexto del scoring. */
export const jobPreferencesSchema = z.object({
  salaryMin: z.number().int().positive().nullable(),
  salaryCurrency: z.enum(SALARY_CURRENCIES),
  salaryPeriod: z.enum(SALARY_PERIODS),
  salaryBasis: z.enum(SALARY_BASES),
  modalities: z.array(z.enum(JOB_MODALITIES)).min(1, 'Elige al menos una modalidad'),
  /** Ciudades aceptables para trabajo híbrido o presencial. */
  cities: listOfShortTexts(20, 80),
  /** Condiciones que descartan una oferta sin importar lo demás. */
  dealbreakers: listOfShortTexts(30, 200),
  /** Áreas o tecnologías hacia las que se quiere orientar la carrera. */
  interests: listOfShortTexts(30, 200),
  /** Disponible para cambiarse de ciudad; `null` = sin indicar. */
  willingToRelocate: z.boolean().nullable(),
});

export type JobPreferences = z.infer<typeof jobPreferencesSchema>;

export const DEFAULT_JOB_PREFERENCES: JobPreferences = {
  salaryMin: null,
  salaryCurrency: 'CLP',
  salaryPeriod: 'month',
  salaryBasis: 'net',
  modalities: [...JOB_MODALITIES],
  cities: [],
  dealbreakers: [],
  interests: [],
  willingToRelocate: null,
};

/** Fecha de CV: año (`2022`) o año y mes (`2022-03`). */
export const cvDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Usa el formato AAAA o AAAA-MM (ej. 2022 o 2022-03)');

const text = (max: number) => z.string().trim().min(1, 'Obligatorio').max(max);
const optionalText = (max: number) => z.string().trim().max(max);

export const EXPERIENCE_KINDS = ['job', 'internship', 'freelance', 'volunteer', 'project'] as const;

export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number];

export const EXPERIENCE_KIND_LABELS: Record<ExperienceKind, string> = {
  job: 'Empleo',
  internship: 'Práctica',
  freelance: 'Independiente',
  volunteer: 'Voluntariado',
  project: 'Proyecto',
};

export const experienceSchema = z.object({
  kind: z
    .enum(EXPERIENCE_KINDS)
    .describe('Tipo: empleo, práctica, independiente, voluntariado o proyecto'),
  title: text(120).describe('Cargo o rol'),
  company: text(120).describe('Empresa u organización'),
  start: cvDateSchema.nullable().describe('Inicio, AAAA o AAAA-MM; null si el CV no lo indica'),
  /** `null` = actualidad. */
  end: cvDateSchema.nullable().describe('Término, AAAA o AAAA-MM; null si sigue vigente'),
  highlights: z.array(text(400)).max(15).describe('Responsabilidades y logros concretos'),
});

export const EDUCATION_STATUSES = ['completed', 'graduated', 'in_progress', 'incomplete'] as const;

export const EDUCATION_STATUS_LABELS: Record<(typeof EDUCATION_STATUSES)[number], string> = {
  completed: 'Titulado',
  graduated: 'Egresado (sin título)',
  in_progress: 'En curso',
  incomplete: 'Incompleto',
};

export const educationSchema = z.object({
  degree: text(160).describe('Título o carrera'),
  institution: text(160),
  start: cvDateSchema.nullable(),
  end: cvDateSchema.nullable(),
  status: z.enum(EDUCATION_STATUSES).nullable().describe('null si el CV no lo indica'),
});

export const certificationSchema = z.object({
  name: text(160),
  issuer: optionalText(120).nullable(),
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Año de 4 dígitos')
    .nullable(),
});

export const languageSchema = z.object({
  language: text(60),
  level: optionalText(60).nullable().describe('Tal como lo indica el CV (ej. "intermedio", "B2")'),
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/\S+$/;
const urlSchema = z.string().trim().max(300).regex(URL_PATTERN, 'Debe empezar con https://');

export const profileLinkSchema = z.object({
  label: text(60).describe('Nombre del enlace (ej. "Portafolio")'),
  url: urlSchema,
});

/**
 * Datos de contacto y enlaces. Se usan para postular; no se incluyen en el `profile.md` porque la
 * evaluación de ofertas no los necesita.
 */
export const contactSchema = z.object({
  email: z.string().trim().max(120).regex(EMAIL_PATTERN, 'Correo inválido').nullable(),
  phone: optionalText(30).nullable(),
  linkedin: urlSchema.nullable(),
  github: urlSchema.nullable(),
  links: z.array(profileLinkSchema).max(10).describe('Otros enlaces: portafolio, sitio web, etc.'),
});

export type Contact = z.infer<typeof contactSchema>;

/** Grupo libre de habilidades: los nombres dependen de la profesión (no son fijos). */
export const skillGroupSchema = z.object({
  name: text(60).describe('Nombre del grupo, según la profesión (ej. "Equipamiento médico")'),
  items: z.array(text(80)).min(1, 'Agrega al menos una').max(40),
});

/**
 * Niveles que usan los portales de empleo en todas las áreas, no solo en tecnología. `null` en
 * el perfil = sin indicar o no aplica.
 */
export const CAREER_LEVELS = ['intern', 'junior', 'mid', 'senior', 'lead', 'manager'] as const;

export type CareerLevel = (typeof CAREER_LEVELS)[number];

export const CAREER_LEVEL_LABELS: Record<CareerLevel, string> = {
  intern: 'Práctica / Trainee',
  junior: 'Junior',
  mid: 'Semi senior',
  senior: 'Senior',
  lead: 'Jefatura / Supervisión',
  manager: 'Gerencia / Dirección',
};

/**
 * Perfil profesional estructurado, para cualquier profesión. Lo extrae la IA del CV y el usuario
 * lo edita en la web; el `profile.md` que recibe la IA al evaluar ofertas se arma desde aquí.
 */
export const profileDataSchema = z.object({
  fullName: optionalText(120),
  headline: optionalText(120).describe('Profesión o rol en pocas palabras'),
  summary: optionalText(2000).describe('2 a 4 frases: profesión, experiencia y foco'),
  contact: contactSchema,
  careerLevel: z
    .enum(CAREER_LEVELS)
    .nullable()
    .describe('Solo si el CV lo indica explícitamente; si no, null'),
  yearsOfExperience: z
    .number()
    .int()
    .min(0)
    .max(60)
    .nullable()
    .describe('Años de experiencia profesional (empleos, prácticas e independiente)'),
  experience: z.array(experienceSchema).max(40),
  skills: z.array(skillGroupSchema).max(12),
  education: z.array(educationSchema).max(15),
  certifications: z.array(certificationSchema).max(30),
  languages: z.array(languageSchema).max(10),
  additionalInfo: optionalText(3000).describe('Comentarios adicionales relevantes'),
});

export type ProfileData = z.infer<typeof profileDataSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;

export const EMPTY_PROFILE_DATA: ProfileData = {
  fullName: '',
  headline: '',
  summary: '',
  contact: { email: null, phone: null, linkedin: null, github: null, links: [] },
  careerLevel: null,
  yearsOfExperience: null,
  experience: [],
  skills: [],
  education: [],
  certifications: [],
  languages: [],
  additionalInfo: '',
};

/** Partes del perfil, en el orden del wizard. Las recomendaciones de la IA se asocian a una. */
export const PROFILE_SECTIONS = [
  'basics',
  'contact',
  'level',
  'experience',
  'education',
  'skills',
  'languages',
  'preferences',
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/** Consejo de la IA para mejorar una sección del perfil. Se muestra en el paso correspondiente. */
export const profileRecommendationSchema = z.object({
  section: z.enum(PROFILE_SECTIONS).describe('Sección del perfil donde se resuelve'),
  text: text(300).describe('Consejo concreto y breve'),
});

export type ProfileRecommendation = z.infer<typeof profileRecommendationSchema>;

/**
 * Perfil en edición (wizard). Se guarda en cada paso; recién al confirmarlo reemplaza al perfil
 * confirmado, que es el que usa la evaluación de ofertas.
 */
export const profileDraftSchema = z.object({
  /** Si partió desde un CV (prellenado por la IA) o desde el perfil confirmado/vacío. */
  source: z.enum(['cv', 'manual']),
  /** Paso del wizard en el que quedó. */
  step: z.number().int().min(0).max(20),
  data: profileDataSchema,
  preferences: jobPreferencesSchema,
  recommendations: z.array(profileRecommendationSchema).max(15),
});

export type ProfileDraft = z.infer<typeof profileDraftSchema>;

export interface CvInfo {
  filename: string;
  sizeBytes: number;
  pages: number;
  uploadedAt: string;
}

export interface Profile {
  cv: CvInfo | null;
  /** Perfil confirmado; `null` si todavía no se completa el wizard por primera vez. */
  data: ProfileData | null;
  /** Preferencias confirmadas (las por defecto si aún no hay perfil). */
  preferences: JobPreferences;
  confirmedAt: string | null;
  /** Wizard en curso, si hay uno. */
  draft: (ProfileDraft & { updatedAt: string }) | null;
  /** Con qué IA se extrajo el último CV. */
  generated: { at: string; provider: LlmProvider; model: string } | null;
}
