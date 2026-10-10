import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module.js';
import { UsersService } from '../users/users.service.js';
import { SessionsService } from './sessions.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('SessionsService', () => {
  let sessions: SessionsService;
  let userId: number;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    sessions = moduleRef.get(SessionsService);
    const user = await moduleRef
      .get(UsersService)
      .create({ email: 'a@b.cl', name: 'A', password: 'una-clave-segura' });
    userId = user.id;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('valida una sesión recién creada sin renovarla', () => {
    const { token } = sessions.create(userId);
    expect(sessions.validate(token)).toMatchObject({ user: { id: userId }, renewedUntil: null });
  });

  it('expira después de SESSION_TTL_DAYS (30 por defecto)', () => {
    const { token } = sessions.create(userId);
    vi.setSystemTime(Date.now() + 31 * DAY_MS);
    expect(sessions.validate(token)).toBeNull();
  });

  it('se renueva si se usa pasada la mitad de su duración', () => {
    const { token, expiresAt } = sessions.create(userId);
    vi.setSystemTime(Date.now() + 20 * DAY_MS);
    const result = sessions.validate(token);
    expect(result?.renewedUntil?.getTime()).toBeGreaterThan(expiresAt.getTime());
  });

  it('revokeAllForUser cierra todas las sesiones del usuario', () => {
    const a = sessions.create(userId);
    const b = sessions.create(userId);
    sessions.revokeAllForUser(userId);
    expect(sessions.validate(a.token)).toBeNull();
    expect(sessions.validate(b.token)).toBeNull();
  });

  it('deleteExpired elimina solo las sesiones vencidas', () => {
    sessions.create(userId);
    vi.setSystemTime(Date.now() + 31 * DAY_MS);
    const vigente = sessions.create(userId);
    expect(sessions.deleteExpired()).toBe(1);
    expect(sessions.validate(vigente.token)).not.toBeNull();
  });
});
