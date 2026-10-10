import type { LlmTestResult } from '@job-finder/shared';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LlmSettingsService } from './llm-settings.service.js';
import type { LlmProvider, LlmRequest, LlmResult } from './llm.types.js';
import { AnthropicApiProvider } from './providers/anthropic-api.provider.js';
import { ClaudeCliProvider } from './providers/claude-cli.provider.js';

const connectionTestSchema = z.object({ ok: z.boolean() });

/** Punto de entrada para pedirle algo a Claude en nombre de un usuario, con su proveedor. */
@Injectable()
export class LlmService {
  private readonly providers: Record<LlmProvider['id'], LlmProvider>;

  constructor(
    @Inject(LlmSettingsService) private readonly settings: LlmSettingsService,
    @Inject(ClaudeCliProvider) claudeCli: ClaudeCliProvider,
    @Inject(AnthropicApiProvider) anthropicApi: AnthropicApiProvider,
  ) {
    this.providers = { 'claude-cli': claudeCli, 'anthropic-api': anthropicApi };
  }

  generate<T extends z.ZodType>(
    userId: number,
    request: LlmRequest<T>,
  ): Promise<LlmResult<z.infer<T>>> {
    const { provider, apiKey } = this.settings.getStored(userId);
    return this.providers[provider].generate(request, { apiKey: apiKey ?? undefined });
  }

  /** Prueba de conexión: una respuesta estructurada mínima con el proveedor del usuario. */
  async testConnection(userId: number): Promise<LlmTestResult> {
    const { provider, model, durationMs } = await this.generate(userId, {
      system: 'Eres una prueba de conexión. Responde exactamente lo que se pide.',
      prompt: 'Responde con ok = true.',
      schema: connectionTestSchema,
    });
    return { provider, model, durationMs };
  }
}
