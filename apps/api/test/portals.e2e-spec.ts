import { createDemoConnection, startDemoPortal } from '@job-finder/sources';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SecretBox } from '../src/common/crypto/secret-box.js';
import { DATABASE, type Database } from '../src/database/database.module.js';
import { portalAccounts } from '../src/database/schema.js';
import { PORTAL_CONNECTIONS, PortalsService } from '../src/portals/portals.service.js';
import { UsersService } from '../src/users/users.service.js';

// Navegador real contra el portal de demostración.
describe('Portales (e2e)', { timeout: 60_000 }, () => {
  let site: Awaited<ReturnType<typeof startDemoPortal>>;
  let app: NestExpressApplication;
  const magicLink = (token: string) => `${site.origin}/ingresar/enlace?token=${token}`;

  beforeAll(async () => {
    site = await startDemoPortal({ tokens: ['token-valido'] });
  });

  afterAll(async () => {
    await site.close();
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PORTAL_CONNECTIONS)
      .useValue({ demo: createDemoConnection(site.origin) })
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

  const storedSession = (userId: number) =>
    app
      .get<Database>(DATABASE)
      .select()
      .from(portalAccounts)
      .where(and(eq(portalAccounts.userId, userId), eq(portalAccounts.source, 'demo')))
      .get();

  it('requiere sesión', () => request(app.getHttpServer()).get('/api/portals').expect(401));

  it('lista los portales: Empleos Demo disponible y el resto todavía no', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.get('/api/portals').expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({
      source: 'demo',
      name: 'Empleos Demo',
      available: true,
      connectionKind: 'magic-link',
      loginUrl: `${site.origin}/ingresar`,
      enabled: true,
      status: 'disconnected',
      connectedAt: null,
      checkedAt: null,
    });
    expect(res.body.slice(1).every((portal: { available: boolean }) => !portal.available)).toBe(
      true,
    );
  });

  it('conecta con el enlace mágico y guarda la sesión cifrada, sin devolverla', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent
      .post('/api/portals/demo/connect')
      .send({ link: magicLink('token-valido') })
      .expect(200);

    expect(res.body).toMatchObject({ status: 'connected', connectedAt: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain('session');

    const row = storedSession(1);
    expect(row?.sessionEnc).toBeTruthy();
    expect(row?.sessionEnc).not.toContain('demo_session');
    const session = JSON.parse(app.get(SecretBox).decrypt(row!.sessionEnc!));
    expect(session.cookies.map((cookie: { name: string }) => cookie.name)).toContain(
      'demo_session',
    );
  });

  it('rechaza un enlace que no es del portal, sin abrirlo', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent
      .post('/api/portals/demo/connect')
      .send({ link: 'https://example.com/ingresar/enlace?token=x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no es de este portal/);
    expect(storedSession(1)).toBeUndefined();
  });

  it('un enlace vencido no conecta y explica qué hacer', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.post('/api/portals/demo/connect').send({ link: magicLink('vencido') });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Pide uno nuevo/);
    expect(res.body.message).not.toContain('vencido&'); // el enlace no se repite en el error
    expect((await agent.get('/api/portals')).body[0].status).toBe('disconnected');
  });

  it('comprobar una sesión viva la mantiene conectada', async () => {
    const agent = await loginAs('camila@example.com');
    await agent
      .post('/api/portals/demo/connect')
      .send({ link: magicLink('token-valido') })
      .expect(200);
    const res = await agent.post('/api/portals/demo/check').expect(200);
    expect(res.body).toMatchObject({ status: 'connected', checkedAt: expect.any(String) });
  });

  it('una sesión que ya no sirve queda en "Reconectar" y se borra', async () => {
    const agent = await loginAs('camila@example.com');
    await agent
      .post('/api/portals/demo/connect')
      .send({ link: magicLink('token-valido') })
      .expect(200);
    // Simula que el portal cerró la sesión: se guarda una sin cookies.
    app
      .get<Database>(DATABASE)
      .update(portalAccounts)
      .set({ sessionEnc: app.get(SecretBox).encrypt(JSON.stringify({ cookies: [], origins: [] })) })
      .where(eq(portalAccounts.userId, 1))
      .run();

    const res = await agent.post('/api/portals/demo/check').expect(200);
    expect(res.body.status).toBe('expired');
    expect(storedSession(1)?.sessionEnc).toBeNull();
  });

  it('la revisión periódica marca las sesiones vencidas', async () => {
    const agent = await loginAs('camila@example.com');
    await agent
      .post('/api/portals/demo/connect')
      .send({ link: magicLink('token-valido') })
      .expect(200);
    app
      .get<Database>(DATABASE)
      .update(portalAccounts)
      .set({ sessionEnc: app.get(SecretBox).encrypt(JSON.stringify({ cookies: [], origins: [] })) })
      .where(eq(portalAccounts.userId, 1))
      .run();

    await app.get(PortalsService).checkAll();
    expect(storedSession(1)?.status).toBe('expired');
  });

  it('desconectar borra la sesión', async () => {
    const agent = await loginAs('camila@example.com');
    await agent
      .post('/api/portals/demo/connect')
      .send({ link: magicLink('token-valido') })
      .expect(200);
    const res = await agent.delete('/api/portals/demo/session').expect(200);
    expect(res.body).toMatchObject({ status: 'disconnected', connectedAt: null });
    expect(storedSession(1)?.sessionEnc).toBeNull();
  });

  it('activa y desactiva un portal', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent.put('/api/portals/demo').send({ enabled: false }).expect(200);
    expect(res.body.enabled).toBe(false);
  });

  it('un portal que todavía no está disponible responde 404', async () => {
    const agent = await loginAs('camila@example.com');
    const res = await agent
      .post('/api/portals/otro/connect')
      .send({ link: magicLink('token-valido') });
    expect(res.status).toBe(404);
    expect((await agent.post('/api/portals/inventado/check')).status).toBe(400);
  });

  it('cada usuario tiene sus propias conexiones', async () => {
    const camila = await loginAs('camila@example.com');
    await camila
      .post('/api/portals/demo/connect')
      .send({ link: magicLink('token-valido') })
      .expect(200);
    const otra = await loginAs('otra@example.com');
    expect((await otra.get('/api/portals')).body[0].status).toBe('disconnected');
    expect(storedSession(2)).toBeUndefined();
  });
});
