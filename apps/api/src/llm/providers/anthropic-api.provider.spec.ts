import { AuthenticationError } from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validateEnv, type Env } from '../../config/env.js';
import { AnthropicApiProvider, type AnthropicClientFactory } from './anthropic-api.provider.js';

const schema = z.object({ score: z.number() });
const request = { system: 'Sistema', prompt: 'Evalúa esta oferta', schema };

function setup(parse: () => Promise<unknown>) {
  const parseMock = vi.fn<(params: unknown, options?: unknown) => Promise<unknown>>(parse);
  // Cliente falso: solo implementa lo que usa el proveedor.
  const factory = vi.fn<AnthropicClientFactory>(
    () => ({ beta: { messages: { parse: parseMock } } }) as never,
  );
  const config = new ConfigService<Env, true>(validateEnv({ APP_SECRET: 'x'.repeat(32) }));
  return { parseMock, factory, provider: new AnthropicApiProvider(config, factory) };
}

describe('AnthropicApiProvider', () => {
  it('pide salida estructurada con la API key del usuario y fallback ante rechazos', async () => {
    const { provider, parseMock, factory } = setup(async () => ({
      stop_reason: 'end_turn',
      model: 'claude-opus-5-5',
      parsed_output: { score: 4 },
    }));

    await expect(provider.generate(request, { apiKey: 'sk-ant-usuario' })).resolves.toMatchObject({
      data: { score: 4 },
      provider: 'anthropic-api',
      model: 'claude-opus-5-5',
    });
    expect(factory).toHaveBeenCalledWith('sk-ant-usuario');
    expect(parseMock.mock.calls[0]?.[0]).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'Sistema',
      messages: [{ role: 'user', content: 'Evalúa esta oferta' }],
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  });

  it('exige una API key', async () => {
    const { provider } = setup(async () => ({}));
    await expect(provider.generate(request, {})).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('traduce una API key inválida', async () => {
    const { provider } = setup(async () => {
      throw new AuthenticationError(401, undefined, 'invalid x-api-key', new Headers());
    });
    await expect(provider.generate(request, { apiKey: 'sk-ant-mala' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('informa cuando Claude rechaza la solicitud', async () => {
    const { provider } = setup(async () => ({ stop_reason: 'refusal', parsed_output: null }));
    await expect(provider.generate(request, { apiKey: 'sk-ant-x' })).rejects.toMatchObject({
      code: 'refused',
    });
  });

  it('falla con invalid_output si no hay salida parseada', async () => {
    const { provider } = setup(async () => ({ stop_reason: 'max_tokens', parsed_output: null }));
    await expect(provider.generate(request, { apiKey: 'sk-ant-x' })).rejects.toMatchObject({
      code: 'invalid_output',
    });
  });
});
