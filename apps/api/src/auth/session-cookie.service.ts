import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.js';
import { SESSION_COOKIE } from './auth.types.js';

@Injectable()
export class SessionCookieService {
  private readonly options: CookieOptions;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.options = {
      httpOnly: true, // inaccesible desde JavaScript del navegador
      sameSite: 'lax', // no se envía en requests POST de otros sitios (mitiga CSRF)
      secure: config.get('SESSION_COOKIE_SECURE', { infer: true }),
      path: '/',
    };
  }

  set(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, { ...this.options, expires: expiresAt });
  }

  clear(res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.options);
  }
}
