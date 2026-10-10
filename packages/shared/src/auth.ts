import { z } from 'zod';
import { LLM_PROVIDERS } from './llm.js';

export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Email inválido' }));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);

export const loginRequestSchema = z.object({
  email: emailSchema,
  // En el login no se valida el largo: una contraseña corta simplemente no coincide.
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Datos del usuario con sesión iniciada que la API expone al frontend. */
export const sessionUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  name: z.string(),
  llmProvider: z.enum(LLM_PROVIDERS),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;
