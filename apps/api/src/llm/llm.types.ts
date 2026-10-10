import type { LlmProvider as LlmProviderId } from '@job-finder/shared';
import type { z } from 'zod';

export interface LlmRequest<T extends z.ZodType> {
  /** Instrucciones de sistema (rol, reglas). */
  system: string;
  /** Contenido del turno del usuario. */
  prompt: string;
  /** Esquema de la respuesta: la salida se valida contra él. */
  schema: T;
}

export interface LlmResult<T> {
  data: T;
  provider: LlmProviderId;
  model: string;
  durationMs: number;
}

export interface LlmCredentials {
  /** Solo para `anthropic-api`. */
  apiKey?: string;
}

/** Un proveedor que obtiene respuestas estructuradas de Claude. Ver ADR 0006. */
export interface LlmProvider {
  readonly id: LlmProviderId;
  generate<T extends z.ZodType>(
    request: LlmRequest<T>,
    credentials: LlmCredentials,
  ): Promise<LlmResult<z.infer<T>>>;
}

export type LlmErrorCode =
  | 'not_configured'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'refused'
  | 'invalid_output'
  | 'timeout'
  | 'unavailable';

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LlmError';
  }
}
