import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module.js';
import { CvStorageService } from './cv-storage.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
  imports: [LlmModule],
  controllers: [ProfileController],
  providers: [ProfileService, CvStorageService],
  exports: [ProfileService],
})
export class ProfileModule {}
