import { emailSchema, passwordSchema, type SessionUser } from '@job-finder/shared';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { users } from '../database/schema.js';
import { hashPassword, verifyPassword } from './password.js';

type UserRow = typeof users.$inferSelect;

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

// Hash de referencia para que verificar un email inexistente tarde lo mismo que uno existente
// y no se pueda adivinar qué emails tienen cuenta midiendo el tiempo de respuesta.
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(input: CreateUserInput): Promise<SessionUser> {
    const email = emailSchema.parse(input.email);
    const password = passwordSchema.parse(input.password);

    if (this.findRowByEmail(email)) {
      throw new ConflictException(`Ya existe un usuario con el email ${email}`);
    }

    const row = this.db
      .insert(users)
      .values({ email, name: input.name.trim(), passwordHash: await hashPassword(password) })
      .returning()
      .get();
    return toSessionUser(row);
  }

  findById(id: number): SessionUser | undefined {
    const row = this.db.select().from(users).where(eq(users.id, id)).get();
    return row && toSessionUser(row);
  }

  list(): SessionUser[] {
    return this.db.select().from(users).orderBy(users.id).all().map(toSessionUser);
  }

  /** Devuelve el usuario si las credenciales son correctas; `null` en cualquier otro caso. */
  async verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
    const row = this.findRowByEmail(email);
    if (!row) {
      await verifyPassword(await DUMMY_HASH, password);
      return null;
    }
    return (await verifyPassword(row.passwordHash, password)) ? toSessionUser(row) : null;
  }

  /** Cambia la contraseña. Devuelve el usuario, o `undefined` si el email no existe. */
  async setPassword(email: string, password: string): Promise<SessionUser | undefined> {
    const passwordHash = await hashPassword(passwordSchema.parse(password));
    const row = this.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.email, emailSchema.parse(email)))
      .returning()
      .get();
    return row && toSessionUser(row);
  }

  private findRowByEmail(email: string): UserRow | undefined {
    return this.db.select().from(users).where(eq(users.email, email)).get();
  }
}

function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, email: row.email, name: row.name, llmProvider: row.llmProvider };
}
