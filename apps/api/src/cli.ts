/**
 * CLI de administración. No hay registro público: los usuarios se crean desde aquí.
 *
 *   node dist/cli.js user:create --email <email> --name <nombre>
 *   node dist/cli.js user:reset-password --email <email>
 *   node dist/cli.js user:list
 */
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { ZodError, z } from 'zod';
import { AppModule } from './app.module.js';
import { SessionsService } from './auth/sessions.service.js';
import { promptNewPassword } from './cli/prompt.js';
import { UsersService } from './users/users.service.js';

const USAGE = `Uso:
  user:create --email <email> --name <nombre>   Crea un usuario (pide la contraseña)
  user:reset-password --email <email>           Cambia la contraseña y cierra sus sesiones
  user:list                                     Lista los usuarios`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { email: { type: 'string' }, name: { type: 'string' } },
});

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const users = app.get(UsersService);
const sessions = app.get(SessionsService);

try {
  switch (positionals[0]) {
    case 'user:create': {
      if (!values.email || !values.name) throw new Error('Faltan --email y/o --name');
      const user = await users.create({
        email: values.email,
        name: values.name,
        password: await promptNewPassword(),
      });
      console.log(`Usuario creado: #${user.id} ${user.email}`);
      break;
    }
    case 'user:reset-password': {
      if (!values.email) throw new Error('Falta --email');
      const user = await users.setPassword(values.email, await promptNewPassword());
      if (!user) throw new Error(`No existe un usuario con el email ${values.email}`);
      sessions.revokeAllForUser(user.id);
      console.log(`Contraseña actualizada y sesiones cerradas: ${user.email}`);
      break;
    }
    case 'user:list': {
      console.table(users.list());
      break;
    }
    default:
      console.log(USAGE);
      process.exitCode = positionals[0] ? 1 : 0;
  }
} catch (error) {
  const message = error instanceof ZodError ? z.prettifyError(error) : (error as Error).message;
  console.error(`Error: ${message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
