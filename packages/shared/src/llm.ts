import { z } from 'zod';

export const LLM_PROVIDERS = ['claude-cli', 'anthropic-api'] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
  'claude-cli': 'Claude (línea de comandos)',
  'anthropic-api': 'API de Anthropic (API key)',
};

export const ANTHROPIC_API_KEY_PREFIX = 'sk-ant-';

/** Configuración de IA del usuario tal como la ve el frontend (la API key nunca va completa). */
export interface LlmSettings {
  provider: LlmProvider;
  /** Últimos 4 caracteres de la API key guardada, o `null` si no hay. */
  apiKeyHint: string | null;
  /** El CLI de Claude está instalado en el servidor. */
  cliAvailable: boolean;
}

export const updateLlmSettingsSchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  /** Si viene, reemplaza la API key guardada. */
  apiKey: z
    .string()
    .trim()
    .startsWith(ANTHROPIC_API_KEY_PREFIX, `La API key debe empezar con ${ANTHROPIC_API_KEY_PREFIX}`)
    .min(20, 'La API key es demasiado corta')
    .optional(),
});

export type UpdateLlmSettingsRequest = z.infer<typeof updateLlmSettingsSchema>;

export interface LlmTestResult {
  provider: LlmProvider;
  model: string;
  durationMs: number;
}
