import {
  createDemoCatalog,
  createDemoSource,
  startDemoPortal,
  type DemoCatalogEntry,
} from '@job-finder/sources';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DATABASE, type Database } from '../src/database/database.module.js';
import { jobs, searches, searchRuns, userJobs } from '../src/database/schema.js';
import { JOB_SOURCES } from '../src/portals/portals.service.js';
import { SearchRunnerService } from '../src/searches/search-runner.service.js';
import { UsersService } from '../src/users/users.service.js';

const [template] = createDemoCatalog(1, new Date('2026-10-09T12:00:00'));

const offer = (id: number, title: string): DemoCatalogEntry => ({
  ...template!,
  id,
  url: `/ofertas/oferta-${id}`,
  title,
  company: 'Acme',
  salaryRange: '1500 - 2000',
  salaryMin: null,
  salaryMax: null,
  salaryPublic: false,
  seniority: 'Junior',
  schedule: 'Jornada completa',
  workMode: 'hybrid',
  locationText: 'Santiago (Chile)',
  cities: [{ id: 1, name: 'Santiago' }],
  countries: 'Chile',
  publishedAt: '09 de octubre de 2026',
  requiresLinkedin: true,
  requiresGithub: false,
  hasScoredQuestions: false,
  quickApply: false,
  sections: [{ title: 'Requisitos', items: ['SQL avanzado'] }],
  skills: ['SQL', 'Python'],
  benefits: [],
});

const OFFERS = [offer(101, 'Analista de datos'), offer(102, 'QA'), offer(103, 'Backend')];

const PREFERENCES = {
  categoryIds: ['2'],
  seniorityIds: ['2'],
  countryIds: ['1'],
  scheduleIds: ['1'],
  minSalary: 1200,
  remoteOnly: false,
};

// Navegador real contra el portal de demostración.
describe('Búsquedas (e2e)', { timeout: 60_000 }, () => {
  let site: Awaited<ReturnType<typeof startDemoPortal>>;
  let app: NestExpressApplication;
  let db: Database;
  let runner: SearchRunnerService;

  beforeAll(async () => {
    site = await startDemoPortal({
      offers: OFFERS,
      preferences: PREFERENCES,
      pageSize: 2,
      tokens: ['token-valido'],
    });
  });

  afterAll(async () => {
    await site.close();
  });

  beforeEach(async () => {
    site.faults.feedBroken = false;
    site.faults.sessionRevoked = false;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JOB_SOURCES)
      .useValue({ demo: createDemoSource(site.origin) })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    db = app.get<Database>(DATABASE);
    runner = app.get(SearchRunnerService);
    const users = app.get(UsersService);
    await users.create({
      email: 'camila@example.com',
      name: 'Camila',
      password: 'una-clave-segura',
    });
    await users.create({ email: 'otra@example.com', name: 'Otra', password: 'una-clave-segura' });
  });

  afterEach(async () => {
    await runner.whenIdle();
    await app.close();
  });

  async function loginAs(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password: 'una-clave-segura' }).expect(200);
    return agent;
  }

  /** Inicia sesión en la app y conecta el portal con uno de sus enlaces de ingreso. */
  async function connectedAs(email: string) {
    const agent = await loginAs(email);
    await agent
      .post('/api/portals/demo/connect')
      .send({ link: `${site.origin}/ingresar/enlace?token=token-valido` })
      .expect(200);
    return agent;
  }

  /** Lanza la búsqueda y espera a que termine. Devuelve la búsqueda con su última ejecución. */
  async function search(agent: Awaited<ReturnType<typeof loginAs>>) {
    await agent.post('/api/searches/demo/run').expect(202);
    await runner.whenIdle();
    const res = await agent.get('/api/searches').expect(200);
    return res.body[0];
  }

  it('requiere sesión', async () => {
    await request(app.getHttpServer()).get('/api/searches').expect(401);
    await request(app.getHttpServer()).get('/api/jobs').expect(401);
  });

  it('antes de buscar muestra el portal con sus condiciones gestionadas allá', async () => {
    const agent = await loginAs('camila@example.com');

    const res = await agent.get('/api/searches').expect(200);

    expect(res.body).toEqual([
      {
        source: 'demo',
        name: 'Empleos Demo',
        portalStatus: 'disconnected',
        enabled: true,
        conditionsManagedIn: 'portal',
        conditionsUrl: `${site.origin}/para-ti`,
        conditions: null,
        conditionsReadAt: null,
        intervalHours: null,
        lastRun: null,
      },
    ]);
  });

  it('no busca en un portal sin conectar', async () => {
    const agent = await loginAs('camila@example.com');

    const res = await agent.post('/api/searches/demo/run').expect(400);

    expect(res.body.message).toContain('Conecta tu cuenta de Empleos Demo');
  });

  it('responde de inmediato con la ejecución en curso y no acepta otra a la vez', async () => {
    const agent = await connectedAs('camila@example.com');

    const first = await agent.post('/api/searches/demo/run').expect(202);
    const second = await agent.post('/api/searches/demo/run').expect(409);

    expect(first.body).toMatchObject({ trigger: 'manual', status: 'running', finishedAt: null });
    expect(second.body.message).toContain('Ya hay una búsqueda en curso');
  });

  it('guarda las ofertas del feed, su detalle y las condiciones leídas del portal', async () => {
    const agent = await connectedAs('camila@example.com');

    const result = await search(agent);

    expect(result.lastRun).toMatchObject({
      status: 'success',
      step: null,
      found: 3,
      added: 3,
      reachedEnd: true,
      warnings: [],
      error: null,
    });
    expect(result.conditions).toEqual([
      { label: 'Categorías', values: ['Programación'] },
      { label: 'Nivel', values: ['Junior'] },
      { label: 'Países', values: ['Chile'] },
      { label: 'Jornada', values: ['Jornada completa'] },
      { label: 'Sueldo mínimo', values: ['USD 1200 al mes'] },
    ]);
    expect(result.conditionsReadAt).not.toBeNull();

    const list = await agent.get('/api/jobs').expect(200);
    expect(list.body).toHaveLength(3);
    expect(list.body.find((job: { title: string }) => job.title === 'QA')).toMatchObject({
      source: 'demo',
      url: `${site.origin}/ofertas/oferta-102`,
      company: 'Acme',
      location: 'Santiago (Chile)',
      modality: 'hybrid',
      employmentType: 'full-time',
      seniority: 'Junior',
      salary: { min: 1500, max: 2000, currency: 'USD', period: 'month', public: false },
      publishedOn: '2026-10-09',
      status: 'new',
    });

    const stored = db.select().from(jobs).where(eq(jobs.externalId, '101')).get();
    expect(stored).toMatchObject({
      description: '## Requisitos\n\n- SQL avanzado',
      tags: ['SQL', 'Python'],
      applyUrl: `${site.origin}/ofertas/oferta-101/postular`,
      closed: false,
      applyNotes: ['Pide perfil de LinkedIn'],
    });
    expect(stored?.detailFetchedAt).toBeInstanceOf(Date);
  });

  it('buscar no cambia las preferencias guardadas en el portal', async () => {
    const agent = await connectedAs('camila@example.com');

    await search(agent);

    expect(site.account.preferences).toEqual(PREFERENCES);
  });

  it('buscar de nuevo no duplica ofertas', async () => {
    const agent = await connectedAs('camila@example.com');
    await search(agent);

    const again = await search(agent);

    expect(again.lastRun).toMatchObject({ status: 'success', found: 3, added: 0 });
    expect(db.select().from(jobs).all()).toHaveLength(3);
    expect((await agent.get('/api/jobs')).body).toHaveLength(3);
    const runs = await agent.get('/api/searches/demo/runs').expect(200);
    expect(runs.body.map((run: { added: number }) => run.added)).toEqual([0, 3]);
  });

  it('las ofertas son compartidas, pero cada usuario tiene su propia lista', async () => {
    const camila = await connectedAs('camila@example.com');
    await search(camila);
    const otra = await connectedAs('otra@example.com');
    expect((await otra.get('/api/jobs')).body).toEqual([]);

    const result = await search(otra);

    expect(result.lastRun).toMatchObject({ found: 3, added: 3 });
    expect(db.select().from(jobs).all()).toHaveLength(3);
    expect(db.select().from(userJobs).all()).toHaveLength(6);
    expect((await camila.get('/api/searches/demo/runs')).body).toHaveLength(1);
  });

  it('una búsqueda fallida deja el error y las capturas, visibles solo para su dueño', async () => {
    const agent = await connectedAs('camila@example.com');
    site.faults.feedBroken = true;

    const result = await search(agent);

    expect(result.lastRun).toMatchObject({
      status: 'failed',
      found: 0,
      artifacts: ['feed.png', 'feed.html'],
    });
    expect(result.lastRun.error).toContain('formato que no reconozco');
    expect(result.conditions).toBeNull();

    const base = `/api/searches/runs/${result.lastRun.id}/artifacts`;
    const image = await agent.get(`${base}/feed.png`).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    const html = await agent.get(`${base}/feed.html`).expect(200);
    expect(html.headers['content-type']).toContain('text/plain');
    expect(html.text).toContain('Ofertas para ti');
    await agent.get(`${base}/otro.png`).expect(404);

    const otra = await loginAs('otra@example.com');
    await otra.get(`${base}/feed.png`).expect(404);
  });

  it('si la sesión del portal venció, la búsqueda falla y el portal queda por reconectar', async () => {
    const agent = await connectedAs('camila@example.com');
    site.faults.sessionRevoked = true;

    const result = await search(agent);

    expect(result.lastRun.status).toBe('failed');
    expect(result.lastRun.error).toContain('La sesión de Empleos Demo venció');
    expect(result.lastRun.artifacts).toEqual([]);
    expect(result.portalStatus).toBe('expired');
    await agent.post('/api/searches/demo/run').expect(400);
  });

  it('guarda cada cuánto se repite la búsqueda y rechaza otros valores', async () => {
    const agent = await loginAs('camila@example.com');

    const res = await agent.put('/api/searches/demo').send({ intervalHours: 12 }).expect(200);
    await agent.put('/api/searches/demo').send({ intervalHours: 5 }).expect(400);

    expect(res.body.intervalHours).toBe(12);
    expect((await agent.get('/api/searches')).body[0].intervalHours).toBe(12);
  });

  it('las búsquedas automáticas corren solo cuando les toca', async () => {
    const agent = await connectedAs('camila@example.com');
    const triggers = async () =>
      (await agent.get('/api/searches/demo/runs')).body.map(
        (run: { trigger: string }) => run.trigger,
      );

    // Sin frecuencia definida, nunca corre sola.
    runner.runDue();
    await runner.whenIdle();
    expect(await triggers()).toEqual([]);

    await agent.put('/api/searches/demo').send({ intervalHours: 6 }).expect(200);
    runner.runDue();
    await runner.whenIdle();
    expect(await triggers()).toEqual(['scheduled']);

    // Recién corrió: no le toca hasta 6 horas después.
    runner.runDue();
    runner.runDue(new Date(Date.now() + 5 * 60 * 60 * 1000));
    await runner.whenIdle();
    expect(await triggers()).toEqual(['scheduled']);

    runner.runDue(new Date(Date.now() + 7 * 60 * 60 * 1000));
    await runner.whenIdle();
    expect(await triggers()).toEqual(['scheduled', 'scheduled']);
  });

  it('una búsqueda automática no corre si el portal está excluido de las búsquedas', async () => {
    const agent = await connectedAs('camila@example.com');
    await agent.put('/api/searches/demo').send({ intervalHours: 6 }).expect(200);
    await agent.put('/api/portals/demo').send({ enabled: false }).expect(200);

    runner.runDue();
    await runner.whenIdle();

    expect((await agent.get('/api/searches/demo/runs')).body).toEqual([]);
  });

  it('al iniciar, una ejecución que quedó en curso se marca como fallida', async () => {
    const agent = await loginAs('camila@example.com');
    await agent.put('/api/searches/demo').send({ intervalHours: null }).expect(200);
    const row = db.select().from(searches).get()!;
    db.insert(searchRuns).values({ searchId: row.id, trigger: 'manual' }).run();

    runner.onModuleInit();

    const [run] = (await agent.get('/api/searches/demo/runs')).body;
    expect(run.status).toBe('failed');
    expect(run.error).toContain('se reinició');
  });
});
