import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default('data/job-finder.sqlite'),
  /** Archivos subidos por los usuarios (CVs). */
  UPLOADS_DIR: z.string().min(1).default('data/uploads'),
  /** Capturas y HTML que guarda una búsqueda cuando falla. */
  ARTIFACTS_DIR: z.string().min(1).default('data/artifacts'),
  /** Tope de ofertas que lee una búsqueda en un portal. */
  SEARCH_MAX_LISTINGS: z.coerce.number().int().positive().default(100),
  /** Tope de páginas de oferta que abre una búsqueda para leer su detalle. */
  SEARCH_MAX_DETAILS: z.coerce.number().int().nonnegative().default(30),
  /** Pausa mínima entre páginas de un portal; la real varía entre este valor y el triple. */
  PORTAL_PAUSE_MS: z.coerce.number().int().nonnegative().default(1000),
  /** Puerto del portal de demostración que se levanta junto con la API. `0` no lo levanta. */
  DEMO_PORTAL_PORT: z.coerce.number().int().nonnegative().default(4100),
  /** Interfaz donde escucha el portal de demostración. */
  DEMO_PORTAL_HOST: z.string().min(1).default('127.0.0.1'),
  /** Duración de una sesión sin actividad antes de expirar. */
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Secreto para cifrar datos sensibles en la base de datos (API keys). Generar con `openssl rand -base64 32`. */
  APP_SECRET: z.string().min(32, 'APP_SECRET debe tener al menos 32 caracteres'),
  /** Modelo de Claude usado por ambos proveedores. */
  LLM_MODEL: z.string().min(1).default('claude-opus-5-5'),
  /** Nivel de esfuerzo (profundidad de razonamiento) por defecto. */
  LLM_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),
  /** Tiempo máximo de una respuesta de IA. */
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  /** Ejecutable del CLI de Claude (proveedor claude-cli). */
  CLAUDE_CLI_PATH: z.string().min(1).default('claude'),
  /** Cookie solo por HTTPS. Por defecto `true` en producción (detrás del reverse proxy con HTTPS). */
  SESSION_COOKIE_SECURE: z.stringbool().optional(),
});

export type Env = Omit<z.infer<typeof envSchema>, 'SESSION_COOKIE_SECURE'> & {
  SESSION_COOKIE_SECURE: boolean;
};

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(result.error)}`);
  }
  return {
    ...result.data,
    SESSION_COOKIE_SECURE:
      result.data.SESSION_COOKIE_SECURE ?? result.data.NODE_ENV === 'production',
  };
}
