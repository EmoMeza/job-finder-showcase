import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validateEnv, type Env } from '../../config/env.js';
import { LlmError } from '../llm.types.js';
import { ClaudeCliProvider, toCliJsonSchema } from './claude-cli.provider.js';
import type { CommandResult, CommandRunner } from './command-runner.js';

const schema = z.object({ score: z.number() });
const request = { system: 'Sistema', prompt: 'Evalúa esta oferta', schema };

function setup(result: Partial<CommandResult> | Error) {
  const run = vi.fn<CommandRunner>(async () => {
    if (result instanceof Error) throw result;
    return { exitCode: 0, stdout: '', stderr: '', timedOut: false, ...result };
  });
  const config = new ConfigService<Env, true>(validateEnv({ APP_SECRET: 'x'.repeat(32) }));
  return { run, provider: new ClaudeCliProvider(config, run) };
}

const cliOutput = (fields: Record<string, unknown>) =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...fields });

describe('ClaudeCliProvider', () => {
  it('devuelve la salida estructurada validada', async () => {
    const { provider } = setup({ stdout: cliOutput({ structured_output: { score: 4.5 } }) });
    await expect(provider.generate(request)).resolves.toMatchObject({
      data: { score: 4.5 },
      provider: 'claude-cli',
      model: 'claude-opus-5-5',
    });
  });

  it('manda el prompt por stdin y el esquema como JSON Schema, sin herramientas', async () => {
    const { provider, run } = setup({ stdout: cliOutput({ structured_output: { score: 1 } }) });
    await provider.generate(request);

    const [command, args, options] = run.mock.calls[0]!;
    expect(command).toBe('claude');
    expect(options.input).toBe('Evalúa esta oferta');
    expect(args).not.toContain('Evalúa esta oferta');
    expect(args).toEqual(expect.arrayContaining(['-p', '--no-session-persistence']));
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--system-prompt') + 1]).toBe('Sistema');
    expect(JSON.parse(args[args.indexOf('--json-schema') + 1]!)).toMatchObject({
      type: 'object',
      properties: { score: { type: 'number' } },
    });
  });

  it('genera el JSON Schema en draft-07 y sin $schema (lo exige el CLI)', () => {
    const jsonSchema = toCliJsonSchema(z.object({ tags: z.array(z.string()).max(5) }));
    expect(jsonSchema).not.toHaveProperty('$schema');
    expect(jsonSchema).toMatchObject({ type: 'object', required: ['tags'] });
  });

  it('falla con invalid_output si la respuesta no cumple el esquema', async () => {
    const { provider } = setup({ stdout: cliOutput({ structured_output: { score: 'alto' } }) });
    await expect(provider.generate(request)).rejects.toMatchObject({ code: 'invalid_output' });
  });

  it('indica cómo configurar el CLI si no tiene sesión', async () => {
    const { provider } = setup({
      exitCode: 1,
      stdout: cliOutput({
        is_error: true,
        subtype: 'error',
        result: 'Not logged in · Please run /login',
      }),
    });
    await expect(provider.generate(request)).rejects.toMatchObject({
      code: 'not_configured',
      message: expect.stringContaining('CLAUDE_CODE_OAUTH_TOKEN'),
    });
  });

  it('detecta un token inválido o expirado', async () => {
    const { provider } = setup({
      exitCode: 1,
      stdout: cliOutput({ is_error: true, subtype: 'error', result: 'OAuth token has expired' }),
    });
    await expect(provider.generate(request)).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('informa timeout', async () => {
    const { provider } = setup({ timedOut: true, exitCode: null });
    await expect(provider.generate(request)).rejects.toMatchObject({ code: 'timeout' });
  });

  it('informa si el CLI no está instalado', async () => {
    const { provider } = setup(Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }));
    const error = await provider.generate(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ code: 'unavailable' });
    await expect(provider.isAvailable()).resolves.toBe(false);
  });

  it('consulta la disponibilidad del CLI una sola vez', async () => {
    const { provider, run } = setup({ stdout: '2.1.0 (Claude Code)' });
    await provider.isAvailable();
    await provider.isAvailable();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
