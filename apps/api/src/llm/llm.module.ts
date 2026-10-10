import { Module } from '@nestjs/common';
import { LlmSettingsService } from './llm-settings.service.js';
import { LlmController } from './llm.controller.js';
import { LlmService } from './llm.service.js';
import {
  ANTHROPIC_CLIENT_FACTORY,
  AnthropicApiProvider,
  createAnthropicClient,
} from './providers/anthropic-api.provider.js';
import { ClaudeCliProvider } from './providers/claude-cli.provider.js';
import { COMMAND_RUNNER, spawnCommand } from './providers/command-runner.js';

@Module({
  controllers: [LlmController],
  providers: [
    LlmService,
    LlmSettingsService,
    ClaudeCliProvider,
    AnthropicApiProvider,
    { provide: COMMAND_RUNNER, useValue: spawnCommand },
    { provide: ANTHROPIC_CLIENT_FACTORY, useValue: createAnthropicClient },
  ],
  exports: [LlmService],
})
export class LlmModule {}
