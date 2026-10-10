import { loginRequestSchema, type LoginRequest, type SessionUser } from '@job-finder/shared';
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE, type AuthenticatedRequest } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { SessionCookieService } from './session-cookie.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionCookieService) private readonly cookie: SessionCookieService,
  ) {}

  /** POST /api/auth/login — limitado por IP (ver LOGIN_ATTEMPTS_PER_MINUTE). */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const { user, session } = await this.auth.login(body);
    this.cookie.set(res, session.token, session.expiresAt);
    return user;
  }

  /** POST /api/auth/logout — público para poder limpiar la cookie aunque la sesión ya expiró. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response): void {
    this.auth.logout(req.cookies[SESSION_COOKIE]);
    this.cookie.clear(res);
  }

  /** GET /api/auth/me — el usuario de la sesión actual. */
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}
