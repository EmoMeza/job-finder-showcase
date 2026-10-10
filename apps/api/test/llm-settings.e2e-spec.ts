import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DATABASE, type Database } from '../src/database/database.module.js';
import { users } from '../src/database/schema.js';
import { ANTHROPIC_CLIENT_FACTORY } from '../src/llm/providers/anthropic-api.provider.js';
import { COMMAND_RUNNER, type CommandRunner } from '../src/llm/providers/command-runner.js';
import { UsersService } from '../src/users/users.service.js';

const API_KEY = 'sk-ant-api03-clave-de-prueba-WXYZ';

describe('Configuración de IA (e2e)', () => {
  let app: NestExpressApplication;
  let agent: ReturnType<typeof request.agent>;
  const parse = vi.fn<(params: unknown) => Promise<unknown>>();

  beforeEach(async () => {
    parse.mockReset();
    const runner = vi.fn<CommandRunner>(async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        structured_output: { ok: true },
      }),
      stderr: '',
      timedOut: false,
    }));
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COMMAND_RUNNER)
      .useValue(runner)
      .overrideProvider(ANTHROPIC_CLIENT_FACTORY)
      .useValue(() => ({ beta: { messages: { parse } } }))
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    await app
      .get(UsersService)
      .create({ email: 'a@b.cl', name: 'A', password: 'una-clave-segura' });
    agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: 'a@b.cl', password: 'una-clave-segura' })
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
  });

  it('requiere sesión', () => request(app.getHttpServer()).get('/api/settings/llm').expect(401));

  it('por defecto usa el CLI y no tiene API key', async () => {
    const res = await agent.get('/api/settings/llm').expect(200);
    expect(res.body).toEqual({ provider: 'claude-cli', apiKeyHint: null, cliAvailable: true });
  });

  it('no permite elegir la API sin una API key', async () => {
    const res = await agent
      .put('/api/settings/llm')
      .send({ provider: 'anthropic-api' })
      .expect(400);
    expect(res.body.message).toMatch(/API key/);
  });

  it('rechaza una API key con formato inválido', async () => {
    const res = await agent
      .put('/api/settings/llm')
      .send({ provider: 'anthropic-api', apiKey: 'no-es-una-key' });
    expect(res.status).toBe(400);
    expect(res.body.errors.apiKey).toBeDefined();
  });

  it('guarda la API key cifrada y solo devuelve sus últimos 4 caracteres', async () => {
    const res = await agent
      .put('/api/settings/llm')
      .send({ provider: 'anthropic-api', apiKey: API_KEY })
      .expect(200);
    expect(res.body).toMatchObject({ provider: 'anthropic-api', apiKeyHint: 'WXYZ' });
    expect(JSON.stringify(res.body)).not.toContain(API_KEY);

    const stored = app
      .get<Database>(DATABASE)
      .select()
      .from(users)
      .where(eq(users.email, 'a@b.cl'))
      .get();
    expect(stored?.anthropicApiKeyEnc).toBeTruthy();
    expect(stored?.anthropicApiKeyEnc).not.toContain('sk-ant');
  });

  it('prueba la conexión con el proveedor elegido', async () => {
    await agent
      .post('/api/settings/llm/test')
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({ provider: 'claude-cli', model: 'claude-opus-5-5' });
      });

    parse.mockResolvedValue({
      stop_reason: 'end_turn',
      model: 'claude-opus-5-5',
      parsed_output: { ok: true },
    });
    await agent
      .put('/api/settings/llm')
      .send({ provider: 'anthropic-api', apiKey: API_KEY })
      .expect(200);
    await agent
      .post('/api/settings/llm/test')
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({ provider: 'anthropic-api' });
      });
  });

  it('borrar la API key vuelve al CLI', async () => {
    await agent
      .put('/api/settings/llm')
      .send({ provider: 'anthropic-api', apiKey: API_KEY })
      .expect(200);
    const res = await agent.delete('/api/settings/llm/api-key').expect(200);
    expect(res.body).toMatchObject({ provider: 'claude-cli', apiKeyHint: null });
  });
});
