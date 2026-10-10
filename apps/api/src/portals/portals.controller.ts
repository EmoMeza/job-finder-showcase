import {
  connectWithMagicLinkSchema,
  SOURCE_IDS,
  updatePortalSchema,
  type ConnectWithMagicLinkRequest,
  type PortalAccount,
  type SessionUser,
  type SourceId,
  type UpdatePortalRequest,
} from '@job-finder/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PortalsService } from './portals.service.js';

const SourceParam = () => Param('source', new ZodValidationPipe(z.enum(SOURCE_IDS)));

/** Portales de empleo del usuario de la sesión. */
@Controller('portals')
export class PortalsController {
  constructor(@Inject(PortalsService) private readonly portals: PortalsService) {}

  /** GET /api/portals */
  @Get()
  list(@CurrentUser() user: SessionUser): PortalAccount[] {
    return this.portals.list(user.id);
  }

  /** PUT /api/portals/:source — activa o desactiva el portal. */
  @Put(':source')
  update(
    @CurrentUser() user: SessionUser,
    @SourceParam() source: SourceId,
    @Body(new ZodValidationPipe(updatePortalSchema)) body: UpdatePortalRequest,
  ): PortalAccount {
    return this.portals.setEnabled(user.id, source, body.enabled);
  }

  /** POST /api/portals/:source/connect — conecta con el enlace mágico. Limitado por IP. */
  @Post(':source/connect')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  connect(
    @CurrentUser() user: SessionUser,
    @SourceParam() source: SourceId,
    @Body(new ZodValidationPipe(connectWithMagicLinkSchema)) body: ConnectWithMagicLinkRequest,
  ): Promise<PortalAccount> {
    return this.portals.connectWithMagicLink(user.id, source, body.link);
  }

  /** POST /api/portals/:source/check — comprueba que la sesión siga viva. */
  @Post(':source/check')
  @HttpCode(200)
  check(@CurrentUser() user: SessionUser, @SourceParam() source: SourceId): Promise<PortalAccount> {
    return this.portals.check(user.id, source);
  }

  /** DELETE /api/portals/:source/session — borra la sesión guardada. */
  @Delete(':source/session')
  disconnect(@CurrentUser() user: SessionUser, @SourceParam() source: SourceId): PortalAccount {
    return this.portals.disconnect(user.id, source);
  }
}
