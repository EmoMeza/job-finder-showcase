import type { LoginRequest, SessionUser } from '@job-finder/shared';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { SessionsService, type CreatedSession } from './sessions.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
  ) {}

  async login({
    email,
    password,
  }: LoginRequest): Promise<{ user: SessionUser; session: CreatedSession }> {
    const user = await this.users.verifyCredentials(email, password);
    if (!user) {
      // Mismo mensaje para email inexistente y contraseña incorrecta.
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    this.sessions.deleteExpired();
    return { user, session: this.sessions.create(user.id) };
  }

  logout(token: string | undefined): void {
    if (token) this.sessions.revoke(token);
  }
}
