import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CV_MAX_BYTES,
  DEFAULT_JOB_PREFERENCES,
  EMPTY_PROFILE_DATA,
  type ProfileData,
  type ProfileRecommendation,
} from '@job-finder/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DATABASE, type Database } from '../src/database/database.module.js';
import { profiles } from '../src/database/schema.js';
import { COMMAND_RUNNER, type CommandRunner } from '../src/llm/providers/command-runner.js';
import { UsersService } from '../src/users/users.service.js';

const CV_PDF = readFileSync(join(import.meta.dirname, 'fixtures/cv-ejemplo.pdf'));
const SCANNED_PDF = readFileSync(join(import.meta.dirname, 'fixtures/cv-sin-texto.pdf'));
const EXTRACTED: ProfileData = {
  ...EMPTY_PROFILE_DATA,
  fullName: 'Camila Rojas Fuentes',
  headline: 'Desarrolladora Backend',
  experience: [
    {
      kind: 'job',
      title: 'Backend Developer',
      company: 'Empresa Ficticia SpA',
      start: '2022-03',
      end: null,
      highlights: ['Diseño de APIs REST'],
    },
  ],
  skills: [{ name: 'Lenguajes', items: ['TypeScript'] }],
};
const RECOMMENDATIONS: ProfileRecommendation[] = [
  { section: 'education', text: 'Indica si estás titulada o egresada.' },
];

describe('Mi perfil (e2e)', () => {
  let app: NestExpressApplication;
  let runner: ReturnType<typeof vi.fn<CommandRunner>>;

  beforeEach(async () => {
    // CLI de Claude falso: responde siempre el mismo perfil.
    runner = vi.fn<CommandRunner>(async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        structured_output: { profile: EXTRACTED, recommendations: RECOMMENDATIONS },
      }),
      stderr: '',
      timedOut: false,
    }));
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COMMAND_RUNNER)
      .useValue(runner)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    const users = app.get(UsersService);
    await users.create({
      email: 'camila@example.com',
      name: 'Camila',
      password: 'una-clave-segura',
    });
    await users.create({ email: 'otra@example.com', name: 'Otra', password: 'una-clave-segura' });
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginAs(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password: 'una-clave-segura' }).expect(200);
    return agent;
  }

  it('requiere sesión', () => request(app.getHttpServer()).get('/api/profile').expect(401));

  it('parte vacío con las preferencias por defecto', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.get('/api/profile').expect(200);
    expect(res.body).toEqual({
      cv: null,
      data: null,
      preferences: DEFAULT_JOB_PREFERENCES,
      confirmedAt: null,
      draft: null,
      generated: null,
    });
  });

  it('sube el CV, extrae el texto y permite descargarlo', async () => {
    const agent = await loginAs('camila@example.com');
    const upload = await agent
      .post('/api/profile/cv')
      .attach('file', CV_PDF, { filename: 'Currículum Camila.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(upload.body.cv).toMatchObject({
      filename: 'Currículum Camila.pdf',
      sizeBytes: CV_PDF.length,
      pages: 1,
    });

    const download = await agent.get('/api/profile/cv').buffer(true).expect(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(download.body as Buffer, CV_PDF)).toBe(0);
  });

  it('rechaza archivos que no son PDF aunque digan serlo', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.post('/api/profile/cv').attach('file', Buffer.from('no soy un pdf'), {
      filename: 'cv.pdf',
      contentType: 'application/pdf',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/PDF/);
  });

  it('rechaza un PDF escaneado sin texto', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.post('/api/profile/cv').attach('file', SCANNED_PDF, 'cv.pdf');
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/escaneado/);
  });

  it('rechaza un CV de más de 10 MB', async () => {
    const agent = await loginAs('camila@example.com');
    const big = Buffer.concat([CV_PDF, Buffer.alloc(CV_MAX_BYTES)]);
    const res = await agent.post('/api/profile/cv').attach('file', big, 'cv.pdf');
    expect(res.status).toBe(413);
  });

  it('no abre el wizard desde el CV si no hay CV', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.post('/api/profile/draft/from-cv');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sube tu CV/);
  });

  it('la IA lee el CV y abre un borrador prellenado con recomendaciones', async () => {
    const agent = await loginAs('camila@example.com');
    await agent.post('/api/profile/cv').attach('file', CV_PDF, 'cv.pdf').expect(200);

    const res = await agent.post('/api/profile/draft/from-cv').expect(200);
    expect(res.body.data).toBeNull(); // aún no confirmado
    expect(res.body.draft).toMatchObject({
      source: 'cv',
      step: 1,
      recommendations: RECOMMENDATIONS,
      preferences: DEFAULT_JOB_PREFERENCES,
    });
    expect(res.body.draft.data.headline).toBe('Desarrolladora Backend');
    // El CV de la IA no traía correo: se propone el de la cuenta.
    expect(res.body.draft.data.contact.email).toBe('camila@example.com');
    expect(res.body.generated).toMatchObject({ provider: 'claude-cli', model: 'claude-opus-5-5' });

    const sentPrompt = runner.mock.calls.at(-1)?.[2].input ?? '';
    expect(sentPrompt).toContain('<cv>');
    expect(sentPrompt).toContain('Empresa Ficticia SpA');
  });

  it('guarda el avance y al confirmar reemplaza el perfil', async () => {
    const agent = await loginAs('camila@example.com');
    await agent.post('/api/profile/cv').attach('file', CV_PDF, 'cv.pdf').expect(200);
    const { body } = await agent.post('/api/profile/draft/from-cv').expect(200);

    const draft = {
      source: body.draft.source,
      step: 4,
      data: { ...body.draft.data, careerLevel: 'mid', yearsOfExperience: 4 },
      preferences: { ...DEFAULT_JOB_PREFERENCES, dealbreakers: ['Que implique conducir'] },
      recommendations: [],
    };
    const saved = await agent.put('/api/profile/draft').send(draft).expect(200);
    expect(saved.body.draft).toMatchObject({ step: 4, recommendations: [] });

    const confirmed = await agent.post('/api/profile/draft/confirm').expect(200);
    expect(confirmed.body).toMatchObject({
      data: draft.data,
      preferences: draft.preferences,
      draft: null,
    });
    expect(confirmed.body.confirmedAt).toEqual(expect.any(String));
  });

  it('mientras se edita, el perfil confirmado no cambia; descartar vuelve atrás', async () => {
    const agent = await loginAs('camila@example.com');
    const started = await agent.post('/api/profile/draft').expect(200);
    await agent.post('/api/profile/draft/confirm').expect(200);
    const original = started.body.draft.data;

    const editing = await agent.post('/api/profile/draft').expect(200);
    expect(editing.body.draft.data).toEqual(original); // parte desde el confirmado
    await agent
      .put('/api/profile/draft')
      .send({
        ...editing.body.draft,
        updatedAt: undefined,
        data: { ...original, headline: 'Otro' },
      })
      .expect(200);

    const during = await agent.get('/api/profile').expect(200);
    expect(during.body.data.headline).toBe(original.headline);

    const discarded = await agent.delete('/api/profile/draft').expect(200);
    expect(discarded.body).toMatchObject({ draft: null, data: original });
  });

  it('sin CV, el wizard parte vacío con el nombre y correo de la cuenta', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.post('/api/profile/draft').expect(200);
    expect(res.body.draft).toMatchObject({ source: 'manual', step: 1, recommendations: [] });
    expect(res.body.draft.data).toMatchObject({
      fullName: 'Camila',
      contact: { email: 'camila@example.com' },
    });
  });

  it('no guarda avance si no hay un perfil en edición', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.put('/api/profile/draft').send({
      source: 'manual',
      step: 2,
      data: EMPTY_PROFILE_DATA,
      preferences: DEFAULT_JOB_PREFERENCES,
      recommendations: [],
    });
    expect(res.status).toBe(400);
  });

  it('valida el borrador', async () => {
    const agent = await loginAs('camila@example.com');
    await agent.post('/api/profile/draft').expect(200);
    const res = await agent.put('/api/profile/draft').send({
      source: 'manual',
      step: 2,
      data: { ...EMPTY_PROFILE_DATA, contact: { ...EMPTY_PROFILE_DATA.contact, email: 'x' } },
      preferences: { ...DEFAULT_JOB_PREFERENCES, modalities: [] },
      recommendations: [],
    });
    expect(res.status).toBe(400);
  });

  it('ignora datos guardados que no calzan con el esquema actual', async () => {
    const agent = await loginAs('camila@example.com');
    await agent.post('/api/profile/draft').expect(200);
    app
      .get<Database>(DATABASE)
      .update(profiles)
      .set({ data: { skills: { formato: 'viejo' } } as never, confirmedAt: new Date() })
      .where(eq(profiles.userId, 1))
      .run();
    const res = await agent.get('/api/profile').expect(200);
    expect(res.body).toMatchObject({ data: null, confirmedAt: null });
  });

  it('cada usuario solo accede a su propio perfil', async () => {
    const camila = await loginAs('camila@example.com');
    await camila.post('/api/profile/cv').attach('file', CV_PDF, 'cv.pdf').expect(200);
    await camila.post('/api/profile/draft').expect(200);

    const otra = await loginAs('otra@example.com');
    const res = await otra.get('/api/profile').expect(200);
    expect(res.body).toMatchObject({ cv: null, draft: null });
    expect((await otra.get('/api/profile/cv')).status).toBe(404);
  });
});
