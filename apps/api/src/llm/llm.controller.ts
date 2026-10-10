import {
  updateLlmSettingsSchema,
  type LlmSettings,
  type LlmTestResult,
  type SessionUser,
  type UpdateLlmSettingsRequest,
} from '@job-finder/shared';
import { Body, Controller, Delete, Get, Inject, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LlmSettingsService } from './llm-settings.service.js';
import { LlmService } from './llm.service.js';
import { toHttpException } from './llm-http-error.js';

@Controller('settings/llm')
export class LlmController {
  constructor(
    @Inject(LlmSettingsService) private readonly settings: LlmSettingsService,
    @Inject(LlmService) private readonly llm: LlmService,
  ) {}

  /** GET /api/settings/llm */
  @Get()
  get(@CurrentUser() user: SessionUser): Promise<LlmSettings> {
    return this.settings.get(user.id);
  }

  /** PUT /api/settings/llm — cambia el proveedor y opcionalmente reemplaza la API key. */
  @Put()
  update(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(updateLlmSettingsSchema)) body: UpdateLlmSettingsRequest,
  ): Promise<LlmSettings> {
    return this.settings.update(user.id, body);
  }

  /** DELETE /api/settings/llm/api-key */
  @Delete('api-key')
  deleteApiKey(@CurrentUser() user: SessionUser): Promise<LlmSettings> {
    return this.settings.deleteApiKey(user.id);
  }

  /** POST /api/settings/llm/test — pide una respuesta mínima con el proveedor configurado. */
  @Post('test')
  async test(@CurrentUser() user: SessionUser): Promise<LlmTestResult> {
    try {
      return await this.llm.testConnection(user.id);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}
