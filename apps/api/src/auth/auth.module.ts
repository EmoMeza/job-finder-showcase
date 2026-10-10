import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionCookieService } from './session-cookie.service.js';
import { SessionsService } from './sessions.service.js';

/** Intentos de login permitidos por IP en una ventana de un minuto. */
export const LOGIN_ATTEMPTS_PER_MINUTE = 5;

@Module({
  imports: [
    UsersModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: LOGIN_ATTEMPTS_PER_MINUTE }],
      errorMessage:
        'Demasiados intentos de inicio de sesión. Espera un minuto e inténtalo de nuevo.',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    SessionCookieService,
    // Registra AuthGuard para todas las rutas de la app.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SessionsService],
})
export class AuthModule {}
