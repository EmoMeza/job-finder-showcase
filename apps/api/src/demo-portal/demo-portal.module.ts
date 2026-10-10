import { Module } from '@nestjs/common';
import { DemoPortalService } from './demo-portal.service.js';

@Module({ providers: [DemoPortalService] })
export class DemoPortalModule {}
