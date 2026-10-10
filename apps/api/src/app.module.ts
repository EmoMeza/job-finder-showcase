import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module.js';
import { BrowserModule } from './browser/browser.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { DemoPortalModule } from './demo-portal/demo-portal.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { LlmModule } from './llm/llm.module.js';
import { PortalsModule } from './portals/portals.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { SearchesModule } from './searches/searches.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // En desarrollo se usa el .env de la raíz del monorepo.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CryptoModule,
    BrowserModule,
    DemoPortalModule,
    HealthModule,
    UsersModule,
    AuthModule,
    LlmModule,
    ProfileModule,
    PortalsModule,
    JobsModule,
    SearchesModule,
  ],
})
export class AppModule {}
