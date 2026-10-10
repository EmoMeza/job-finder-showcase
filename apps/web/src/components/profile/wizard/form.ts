import { profileDraftSchema, type ProfileSection } from '@job-finder/shared';
import { createContext, useContext } from 'react';
import type { FieldPath } from 'react-hook-form';
import type { z } from 'zod';

/** Lo que se edita en el wizard (el paso y el origen los maneja el wizard aparte). */
export const wizardSchema = profileDraftSchema.pick({
  data: true,
  preferences: true,
  recommendations: true,
});

export type WizardValues = z.infer<typeof wizardSchema>;

export interface WizardStep {
  id: string;
  title: string;
  /** Qué se hace en el paso, en una frase. */
  description: string;
  /** Sección del perfil: define qué recomendaciones de la IA se muestran. */
  section: ProfileSection | null;
  /** Campos que se validan antes de avanzar. */
  fields: FieldPath<WizardValues>[];
  /** La IA completa este paso desde el CV (se marca con destacador hasta revisarlo). */
  prefillable: boolean;
}

/** El paso 0 (CV) se resuelve antes de abrir el borrador; el wizard edita del 1 en adelante. */
export const WIZARD_STEPS: WizardStep[] = [
  { id: 'cv', title: 'Tu CV', description: '', section: null, fields: [], prefillable: false },
  {
    id: 'basics',
    title: 'Datos básicos',
    description: 'Cómo te presentas: nombre, profesión y un resumen breve.',
    section: 'basics',
    fields: ['data.fullName', 'data.headline', 'data.summary'],
    prefillable: true,
  },
  {
    id: 'contact',
    title: 'Contacto y enlaces',
    description: 'Para postular. No se envían a la IA al evaluar ofertas.',
    section: 'contact',
    fields: ['data.contact'],
    prefillable: true,
  },
  {
    id: 'level',
    title: 'Nivel',
    description:
      'Tu nivel y años de experiencia. Si en tu área no se usan niveles, elige "No aplica".',
    section: 'level',
    fields: ['data.careerLevel', 'data.yearsOfExperience'],
    prefillable: true,
  },
  {
    id: 'experience',
    title: 'Experiencia',
    description: 'Empleos, prácticas, trabajo independiente, voluntariados y proyectos.',
    section: 'experience',
    fields: ['data.experience'],
    prefillable: true,
  },
  {
    id: 'education',
    title: 'Educación',
    description: 'Tus estudios y si estás titulado, egresado o cursando.',
    section: 'education',
    fields: ['data.education'],
    prefillable: true,
  },
  {
    id: 'skills',
    title: 'Habilidades',
    description: 'Agrupadas como tenga sentido en tu profesión. Puedes renombrar o crear grupos.',
    section: 'skills',
    fields: ['data.skills'],
    prefillable: true,
  },
  {
    id: 'languages',
    title: 'Idiomas y certificaciones',
    description: 'Idiomas con su nivel y certificaciones o cursos relevantes.',
    section: 'languages',
    fields: ['data.languages', 'data.certifications'],
    prefillable: true,
  },
  {
    id: 'preferences',
    title: 'Qué buscas',
    description: 'Sirve para filtrar ofertas y para que la IA sepa qué te importa.',
    section: 'preferences',
    fields: ['preferences'],
    prefillable: false,
  },
  {
    id: 'review',
    title: 'Revisión',
    description: 'Así queda tu perfil. Es exactamente lo que leerá la IA al evaluar ofertas.',
    section: null,
    fields: [],
    prefillable: false,
  },
];

export const REVIEW_STEP = WIZARD_STEPS.length - 1;

/** `true` en el paso que todavía no se revisa de un borrador prellenado por la IA. */
export const PrefilledContext = createContext(false);

export const usePrefilled = () => useContext(PrefilledContext);
