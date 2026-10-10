import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { UsersService } from '../src/users/users.service.js';

const CREDENTIALS = { email: 'emo@example.com', password: 'una-clave-segura' };

describe('Autenticación (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    await app.get(UsersService).create({ ...CREDENTIALS, name: 'Emo' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('rechaza rutas protegidas sin sesión', () =>
    request(app.getHttpServer()).get('/api/auth/me').expect(401));

  it('rechaza una cookie de sesión inventada', () =>
    request(app.getHttpServer()).get('/api/auth/me').set('Cookie', 'sid=inventada').expect(401));

  it('permite acceder a health sin sesión', () =>
    request(app.getHttpServer()).get('/api/health').expect(200));

  it('responde 401 con contraseña incorrecta, sin revelar si el email existe', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ ...CREDENTIALS, password: 'incorrecta' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ ...CREDENTIALS, email: 'nadie@example.com' })
      .expect(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('responde 400 si el body es inválido', () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'no-es-email' })
      .expect(400));

  it('login → me → logout', async () => {
    const agent = request.agent(app.getHttpServer());

    const login = await agent.post('/api/auth/login').send(CREDENTIALS).expect(200);
    expect(login.body).toMatchObject({ email: CREDENTIALS.email, name: 'Emo' });
    expect(login.body).not.toHaveProperty('passwordHash');
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^sid=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    await agent
      .get('/api/auth/me')
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe(CREDENTIALS.email);
      });

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('el logout invalida la sesión en el servidor, no solo la cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(CREDENTIALS)
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0]?.split(';')[0] ?? '';

    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });
});
