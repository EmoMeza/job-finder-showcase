import {
  CV_MAX_BYTES,
  profileDraftSchema,
  type Profile,
  type ProfileDraft,
  type SessionUser,
} from '@job-finder/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { toHttpException } from '../llm/llm-http-error.js';
import { ProfileService } from './profile.service.js';

/** Todo es del usuario de la sesión: no hay forma de pedir el perfil de otro. */
@Controller('profile')
export class ProfileController {
  constructor(@Inject(ProfileService) private readonly profiles: ProfileService) {}

  /** GET /api/profile */
  @Get()
  get(@CurrentUser() user: SessionUser): Profile {
    return this.profiles.get(user.id);
  }

  /** POST /api/profile/cv — multipart con el campo `file` (PDF, máx. 10 MB). */
  @Post('cv')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CV_MAX_BYTES, files: 1 },
      // Por defecto multer lee el nombre del archivo como latin1 y rompe las tildes.
      defParamCharset: 'utf8',
    }),
  )
  uploadCv(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Profile> {
    if (!file) throw new BadRequestException('Falta el archivo del CV (campo "file")');
    return this.profiles.uploadCv(user.id, file);
  }

  /** GET /api/profile/cv — descarga el PDF subido. */
  @Get('cv')
  async downloadCv(@CurrentUser() user: SessionUser): Promise<StreamableFile> {
    const { data, filename } = await this.profiles.readCv(user.id);
    return new StreamableFile(data, {
      type: 'application/pdf',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
  }

  /** POST /api/profile/draft/from-cv — la IA lee el CV y abre el wizard prellenado. */
  @Post('draft/from-cv')
  @HttpCode(200)
  async draftFromCv(@CurrentUser() user: SessionUser): Promise<Profile> {
    try {
      return await this.profiles.draftFromCv(user.id);
    } catch (error) {
      throw toHttpException(error);
    }
  }

  /** POST /api/profile/draft — abre el wizard sin IA (desde el perfil actual o vacío). */
  @Post('draft')
  @HttpCode(200)
  startManualDraft(@CurrentUser() user: SessionUser): Profile {
    return this.profiles.startManualDraft(user.id);
  }

  /** PUT /api/profile/draft — guarda el avance del wizard. */
  @Put('draft')
  saveDraft(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(profileDraftSchema)) body: ProfileDraft,
  ): Profile {
    return this.profiles.saveDraft(user.id, body);
  }

  /** POST /api/profile/draft/confirm — el borrador pasa a ser el perfil confirmado. */
  @Post('draft/confirm')
  @HttpCode(200)
  confirmDraft(@CurrentUser() user: SessionUser): Profile {
    return this.profiles.confirmDraft(user.id);
  }

  /** DELETE /api/profile/draft — descarta los cambios del wizard. */
  @Delete('draft')
  discardDraft(@CurrentUser() user: SessionUser): Profile {
    return this.profiles.discardDraft(user.id);
  }
}
