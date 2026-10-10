import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { SESSION_COOKIE, type AuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { SessionCookieService } from './session-cookie.service.js';
import { SessionsService } from './sessions.service.js';

/**
 * Guard global: toda ruta requiere sesión salvo las marcadas con `@Public()`.
 * Es el equivalente a un middleware de autenticación aplicado a toda la app en Express.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(SessionCookieService) private readonly cookie: SessionCookieService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const token = req.cookies[SESSION_COOKIE];
    const session = token ? this.sessions.validate(token) : null;
    if (!token || !session) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    if (session.renewedUntil) {
      this.cookie.set(http.getResponse<Response>(), token, session.renewedUntil);
    }
    req.user = session.user;
    return true;
  }
}
