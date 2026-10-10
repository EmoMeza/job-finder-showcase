import type { LlmProvider, LlmSettings, UpdateLlmSettingsRequest } from '@job-finder/shared';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { SecretBox } from '../common/crypto/secret-box.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { users } from '../database/schema.js';
import { ClaudeCliProvider } from './providers/claude-cli.provider.js';

export interface StoredLlmSettings {
  provider: LlmProvider;
  apiKey: string | null;
}

/** Proveedor de IA elegido por cada usuario y su API key (cifrada en la base de datos). */
@Injectable()
export class LlmSettingsService {
  private readonly logger = new Logger(LlmSettingsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(SecretBox) private readonly secretBox: SecretBox,
    @Inject(ClaudeCliProvider) private readonly claudeCli: ClaudeCliProvider,
  ) {}

  /** Configuración con la API key descifrada. Solo para uso interno, nunca para responder. */
  getStored(userId: number): StoredLlmSettings {
    const row = this.db
      .select({ provider: users.llmProvider, apiKeyEnc: users.anthropicApiKeyEnc })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!row) throw new BadRequestException('Usuario inexistente');
    return { provider: row.provider, apiKey: this.decrypt(row.apiKeyEnc, userId) };
  }

  async get(userId: number): Promise<LlmSettings> {
    const { provider, apiKey } = this.getStored(userId);
    return {
      provider,
      apiKeyHint: apiKey ? apiKey.slice(-4) : null,
      cliAvailable: await this.claudeCli.isAvailable(),
    };
  }

  async update(
    userId: number,
    { provider, apiKey }: UpdateLlmSettingsRequest,
  ): Promise<LlmSettings> {
    const hasKey = apiKey !== undefined || this.getStored(userId).apiKey !== null;
    if (provider === 'anthropic-api' && !hasKey) {
      throw new BadRequestException('Para usar la API de Anthropic hay que ingresar una API key');
    }
    this.db
      .update(users)
      .set({
        llmProvider: provider,
        ...(apiKey !== undefined && { anthropicApiKeyEnc: this.secretBox.encrypt(apiKey) }),
      })
      .where(eq(users.id, userId))
      .run();
    return this.get(userId);
  }

  /** Borra la API key. Si el usuario usaba la API, vuelve al CLI. */
  async deleteApiKey(userId: number): Promise<LlmSettings> {
    this.db
      .update(users)
      .set({ anthropicApiKeyEnc: null, llmProvider: 'claude-cli' })
      .where(eq(users.id, userId))
      .run();
    return this.get(userId);
  }

  private decrypt(apiKeyEnc: string | null, userId: number): string | null {
    if (!apiKeyEnc) return null;
    try {
      return this.secretBox.decrypt(apiKeyEnc);
    } catch {
      // Pasa si cambió APP_SECRET: la key guardada ya no se puede leer y hay que reingresarla.
      this.logger.warn(`No se pudo descifrar la API key del usuario ${userId}`);
      return null;
    }
  }
}
