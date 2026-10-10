import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { SecretBox } from './secret-box.js';

/** Cifrado de secretos guardados en la base de datos (API keys, sesiones de portales). */
@Global()
@Module({
  providers: [
    {
      provide: SecretBox,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SecretBox(config.get('APP_SECRET', { infer: true })),
    },
  ],
  exports: [SecretBox],
})
export class CryptoModule {}
