import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { LlmError, type LlmProvider, type LlmRequest, type LlmResult } from '../llm.types.js';
import { COMMAND_RUNNER, type CommandRunner } from './command-runner.js';

/** Lo que nos interesa de la salida de `claude -p --output-format json`. */
const cliResultSchema = z.object({
  type: z.literal('result'),
  subtype: z.string(),
  is_error: z.boolean(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
});

/**
 * Proveedor que usa el CLI de Claude Code en modo no interactivo (`claude -p`), con la
 * suscripción de Claude configurada en el servidor (`CLAUDE_CODE_OAUTH_TOKEN`).
 * Sin herramientas, sin sesiones guardadas y sin leer configuración del proyecto: solo
 * una respuesta estructurada.
 */
@Injectable()
export class ClaudeCliProvider implements LlmProvider {
  readonly id = 'claude-cli' as const;
  private readonly cliPath: string;
  private readonly model: string;
  private readonly effort: string;
  private readonly timeoutMs: number;
  private availability: Promise<boolean> | undefined;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(COMMAND_RUNNER) private readonly run: CommandRunner,
  ) {
    this.cliPath = config.get('CLAUDE_CLI_PATH', { infer: true });
    this.model = config.get('LLM_MODEL', { infer: true });
    this.effort = config.get('LLM_EFFORT', { infer: true });
    this.timeoutMs = config.get('LLM_TIMEOUT_MS', { infer: true });
  }

  /** Si el CLI está instalado (se consulta una sola vez). */
  isAvailable(): Promise<boolean> {
    this.availability ??= this.run(this.cliPath, ['--version'], { timeoutMs: 10_000 }).then(
      (result) => result.exitCode === 0,
      () => false,
    );
    return this.availability;
  }

  async generate<T extends z.ZodType>(request: LlmRequest<T>): Promise<LlmResult<z.infer<T>>> {
    const startedAt = Date.now();
    const args = [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(toCliJsonSchema(request.schema)),
      '--system-prompt',
      request.system,
      '--model',
      this.model,
      '--effort',
      this.effort,
      '--tools',
      '',
      '--no-session-persistence',
      '--setting-sources',
      '',
    ];

    let result;
    try {
      // El prompt va por stdin: no tiene límite de largo ni aparece en la lista de procesos.
      result = await this.run(this.cliPath, args, {
        input: request.prompt,
        timeoutMs: this.timeoutMs,
      });
    } catch (error) {
      throw new LlmError('unavailable', 'No se pudo ejecutar el CLI de Claude', { cause: error });
    }
    if (result.timedOut) {
      throw new LlmError('timeout', `El CLI de Claude no respondió en ${this.timeoutMs / 1000} s`);
    }

    const output = parseCliOutput(result.stdout);
    if (!output || output.is_error || output.subtype !== 'success') {
      const detail =
        output?.result || result.stderr.trim() || `código de salida ${result.exitCode}`;
      throw toCliError(detail);
    }

    const parsed = request.schema.safeParse(output.structured_output);
    if (!parsed.success) {
      throw new LlmError('invalid_output', 'La respuesta de Claude no cumple el esquema esperado', {
        cause: parsed.error,
      });
    }
    return {
      data: parsed.data,
      provider: this.id,
      model: this.model,
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * El validador del CLI no acepta el dialecto por defecto de zod (draft 2020-12, con `$schema`):
 * se genera draft-07 y sin `$schema`.
 */
export function toCliJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(schema, { target: 'draft-7' });
  return jsonSchema;
}

function toCliError(detail: string): LlmError {
  if (/not logged in|please run \/login/i.test(detail)) {
    return new LlmError(
      'not_configured',
      'El CLI de Claude no tiene sesión en el servidor: configura CLAUDE_CODE_OAUTH_TOKEN (se genera con `claude setup-token`)',
    );
  }
  if (/invalid.*(key|token)|expired|unauthorized|401/i.test(detail)) {
    return new LlmError(
      'invalid_credentials',
      `Credenciales del CLI de Claude inválidas: ${detail.slice(0, 200)}`,
    );
  }
  return new LlmError('unavailable', `El CLI de Claude falló: ${detail.slice(0, 300)}`);
}

function parseCliOutput(stdout: string) {
  try {
    const parsed = cliResultSchema.safeParse(JSON.parse(stdout));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
