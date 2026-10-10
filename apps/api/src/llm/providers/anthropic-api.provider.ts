import Anthropic, {
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';
import type { Env } from '../../config/env.js';
import {
  LlmError,
  type LlmCredentials,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from '../llm.types.js';

export type AnthropicClientFactory = (apiKey: string) => Pick<Anthropic, 'beta'>;

export const ANTHROPIC_CLIENT_FACTORY = Symbol('ANTHROPIC_CLIENT_FACTORY');

export const createAnthropicClient: AnthropicClientFactory = (apiKey) =>
  new Anthropic({ apiKey, maxRetries: 2 });

/** Proveedor que usa la API de Anthropic con la API key del usuario. */
@Injectable()
export class AnthropicApiProvider implements LlmProvider {
  readonly id = 'anthropic-api' as const;
  private readonly model: string;
  private readonly effort: Env['LLM_EFFORT'];
  private readonly timeoutMs: number;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(ANTHROPIC_CLIENT_FACTORY) private readonly createClient: AnthropicClientFactory,
  ) {
    this.model = config.get('LLM_MODEL', { infer: true });
    this.effort = config.get('LLM_EFFORT', { infer: true });
    this.timeoutMs = config.get('LLM_TIMEOUT_MS', { infer: true });
  }

  async generate<T extends z.ZodType>(
    request: LlmRequest<T>,
    { apiKey }: LlmCredentials,
  ): Promise<LlmResult<z.infer<T>>> {
    if (!apiKey) {
      throw new LlmError('not_configured', 'No hay una API key de Anthropic configurada');
    }
    const startedAt = Date.now();

    let response;
    try {
      response = await this.createClient(apiKey).beta.messages.parse(
        {
          model: this.model,
          max_tokens: 16_000,
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
          output_config: { effort: this.effort, format: betaZodOutputFormat(request.schema) },
          // Si el modelo rechaza la solicitud, la API la reintenta con otro modelo adecuado.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { timeout: this.timeoutMs },
      );
    } catch (error) {
      throw toLlmError(error);
    }

    if (response.stop_reason === 'refusal') {
      throw new LlmError('refused', 'Claude rechazó la solicitud');
    }
    if (response.parsed_output === null || response.parsed_output === undefined) {
      throw new LlmError('invalid_output', 'La respuesta de Claude no cumple el esquema esperado');
    }
    return {
      data: response.parsed_output as z.infer<T>,
      provider: this.id,
      model: response.model,
      durationMs: Date.now() - startedAt,
    };
  }
}

function toLlmError(error: unknown): LlmError {
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return new LlmError('invalid_credentials', 'La API key de Anthropic no es válida', {
      cause: error,
    });
  }
  if (error instanceof RateLimitError) {
    return new LlmError('rate_limited', 'Límite de uso de la API de Anthropic alcanzado', {
      cause: error,
    });
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new LlmError('timeout', 'La API de Anthropic no respondió a tiempo', { cause: error });
  }
  if (error instanceof APIError) {
    return new LlmError(
      'unavailable',
      `Error de la API de Anthropic (${error.status ?? 'sin status'})`,
      {
        cause: error,
      },
    );
  }
  return new LlmError('unavailable', 'No se pudo contactar la API de Anthropic', { cause: error });
}
