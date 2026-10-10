import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { LOGIN_ATTEMPTS_PER_MINUTE } from '../src/auth/auth.module.js';

const WRONG_LOGIN = { email: 'nadie@example.com', password: 'incorrecta' };

describe('Seguridad detrás de reverse proxy (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  /** Intento de login fallido como si viniera desde `ip` a través del reverse proxy. */
  const loginFrom = (ip: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send(WRONG_LOGIN);

  async function exhaustAttempts(ip: (attempt: number) => string) {
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_MINUTE; i++) {
      expect((await loginFrom(ip(i))).status).toBe(401);
    }
  }

  it(`bloquea el login con 429 después de ${LOGIN_ATTEMPTS_PER_MINUTE} intentos por minuto`, async () => {
    await exhaustAttempts(() => '203.0.113.10');
    const blocked = await loginFrom('203.0.113.10');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Demasiados intentos/);
  });

  it('cuenta los intentos por IP real del cliente, no por la del proxy', async () => {
    await exhaustAttempts(() => '203.0.113.10');
    expect((await loginFrom('203.0.113.10')).status).toBe(429);
    // Otro cliente que llega por el mismo proxy no queda bloqueado.
    expect((await loginFrom('198.51.100.20')).status).toBe(401);
  });

  it('no permite falsificar la IP agregando X-Forwarded-For desde el cliente', async () => {
    await exhaustAttempts((i) => `10.0.0.${i}, 203.0.113.10`);
    // La IP pública más cercana al proxy sigue siendo la misma: sigue bloqueado.
    expect((await loginFrom('10.0.0.99, 203.0.113.10')).status).toBe(429);
  });

  it('el límite solo aplica al login', async () => {
    const statuses: number[] = [];
    for (let i = 0; i <= LOGIN_ATTEMPTS_PER_MINUTE; i++) {
      statuses.push((await request(app.getHttpServer()).get('/api/health')).status);
    }
    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it('agrega cabeceras de seguridad (helmet)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
