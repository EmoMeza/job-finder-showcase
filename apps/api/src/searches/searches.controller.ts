import {
  SOURCE_IDS,
  updateSearchSchema,
  type PortalSearch,
  type SearchRun,
  type SessionUser,
  type SourceId,
  type UpdateSearchRequest,
} from '@job-finder/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  StreamableFile,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RunArtifactsService } from './run-artifacts.service.js';
import { SearchRunnerService } from './search-runner.service.js';
import { SearchesService } from './searches.service.js';

const SourceParam = () => Param('source', new ZodValidationPipe(z.enum(SOURCE_IDS)));

const ARTIFACT_TYPES: Record<string, string> = {
  png: 'image/png',
  // Se entrega como texto: es el HTML de otro sitio y no debe ejecutarse en el de la app.
  html: 'text/plain; charset=utf-8',
};

/** Búsquedas del usuario de la sesión en cada portal. */
@Controller('searches')
export class SearchesController {
  constructor(
    @Inject(SearchesService) private readonly searches: SearchesService,
    @Inject(SearchRunnerService) private readonly runner: SearchRunnerService,
    @Inject(RunArtifactsService) private readonly artifacts: RunArtifactsService,
  ) {}

  /** GET /api/searches */
  @Get()
  list(@CurrentUser() user: SessionUser): PortalSearch[] {
    return this.searches.list(user.id);
  }

  /** PUT /api/searches/:source — cada cuánto se repite sola. */
  @Put(':source')
  update(
    @CurrentUser() user: SessionUser,
    @SourceParam() source: SourceId,
    @Body(new ZodValidationPipe(updateSearchSchema)) body: UpdateSearchRequest,
  ): PortalSearch {
    return this.searches.setInterval(user.id, source, body.intervalHours);
  }

  /** POST /api/searches/:source/run — la deja corriendo y responde de inmediato. */
  @Post(':source/run')
  @HttpCode(202)
  run(@CurrentUser() user: SessionUser, @SourceParam() source: SourceId): SearchRun {
    return this.runner.start(user.id, source, 'manual');
  }

  /** GET /api/searches/:source/runs — últimas ejecuciones. */
  @Get(':source/runs')
  runs(@CurrentUser() user: SessionUser, @SourceParam() source: SourceId): SearchRun[] {
    return this.searches.runs(user.id, source);
  }

  /** GET /api/searches/runs/:runId/artifacts/:name — captura o HTML de una ejecución fallida. */
  @Get('runs/:runId/artifacts/:name')
  async artifact(
    @CurrentUser() user: SessionUser,
    @Param('runId', ParseIntPipe) runId: number,
    @Param('name') name: string,
  ): Promise<StreamableFile> {
    const run = this.searches.findRun(user.id, runId);
    // Solo se entregan los archivos que la ejecución registró: el nombre no se usa como ruta libre.
    if (!run?.artifacts.includes(name)) throw new NotFoundException('No existe ese archivo');
    const data = await this.artifacts.read(run.id, name).catch(() => null);
    if (!data) throw new NotFoundException('El archivo ya no está disponible');
    return new StreamableFile(data, {
      type: ARTIFACT_TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream',
      disposition: `inline; filename="${name}"`,
    });
  }
}
