import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let users: UsersService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    users = moduleRef.get(UsersService);
  });

  it('crea un usuario normalizando el email y sin exponer el hash', async () => {
    const user = await users.create({
      email: ' Emo@Example.com ',
      name: 'Emo',
      password: 'una-clave-segura',
    });
    expect(user).toEqual({
      id: 1,
      email: 'emo@example.com',
      name: 'Emo',
      llmProvider: 'claude-cli',
    });
  });

  it('no permite emails repetidos', async () => {
    await users.create({ email: 'a@b.cl', name: 'A', password: 'una-clave-segura' });
    await expect(
      users.create({ email: 'A@B.cl', name: 'Otro', password: 'una-clave-segura' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza contraseñas cortas', async () => {
    await expect(users.create({ email: 'a@b.cl', name: 'A', password: 'corta' })).rejects.toThrow(
      /al menos 10 caracteres/,
    );
  });

  it('verifica credenciales', async () => {
    await users.create({ email: 'a@b.cl', name: 'A', password: 'una-clave-segura' });
    expect(await users.verifyCredentials('a@b.cl', 'una-clave-segura')).toMatchObject({
      email: 'a@b.cl',
    });
    expect(await users.verifyCredentials('a@b.cl', 'incorrecta')).toBeNull();
    expect(await users.verifyCredentials('no@existe.cl', 'una-clave-segura')).toBeNull();
  });

  it('cambia la contraseña', async () => {
    await users.create({ email: 'a@b.cl', name: 'A', password: 'una-clave-segura' });
    await users.setPassword('a@b.cl', 'otra-clave-segura');
    expect(await users.verifyCredentials('a@b.cl', 'una-clave-segura')).toBeNull();
    expect(await users.verifyCredentials('a@b.cl', 'otra-clave-segura')).not.toBeNull();
  });
});
