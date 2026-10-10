import {
  CV_MAX_BYTES,
  DEFAULT_JOB_PREFERENCES,
  EMPTY_PROFILE_DATA,
  jobPreferencesSchema,
  profileDataSchema,
  profileDraftSchema,
  profileRecommendationSchema,
  type Profile,
  type ProfileData,
  type ProfileDraft,
} from '@job-finder/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { DATABASE, type Database } from '../database/database.module.js';
import { profiles, users } from '../database/schema.js';
import { LlmService } from '../llm/llm.service.js';
import { CvStorageService } from './cv-storage.service.js';
import { extractCvText, isPdf } from './cv-text.js';
import { EXTRACT_PROFILE_SYSTEM, extractProfilePrompt } from './profile.prompts.js';

type ProfileRow = typeof profiles.$inferSelect;
type ProfileChanges = Partial<Omit<typeof profiles.$inferInsert, 'userId'>>;

export interface UploadedCv {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/** Lo que devuelve la IA al leer el CV: el perfil y consejos por sección. */
const extractionSchema = z.object({
  profile: profileDataSchema,
  recommendations: z.array(profileRecommendationSchema).max(8),
});

/** Primer paso del wizard después del CV (el paso 0 es subir el CV). */
const FIRST_REVIEW_STEP = 1;

/**
 * Perfil de cada usuario. Se edita en un borrador (wizard) que recién al confirmarse reemplaza
 * al perfil confirmado. Ver ADR 0011.
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CvStorageService) private readonly storage: CvStorageService,
    @Inject(LlmService) private readonly llm: LlmService,
  ) {}

  get(userId: number): Profile {
    return this.toProfile(this.findRow(userId));
  }

  /** Guarda el PDF y su texto. No toca el perfil: eso lo hace `draftFromCv`. */
  async uploadCv(userId: number, file: UploadedCv): Promise<Profile> {
    if (file.size > CV_MAX_BYTES) throw new PayloadTooLargeException('El CV supera los 10 MB');
    if (!isPdf(file.buffer)) throw new BadRequestException('El CV debe ser un archivo PDF');

    let extracted;
    try {
      extracted = await extractCvText(file.buffer);
    } catch {
      throw new BadRequestException(
        'No se pudo leer el PDF. ¿Está dañado o protegido con contraseña?',
      );
    }
    if (!extracted.text) {
      throw new UnprocessableEntityException(
        'El PDF no tiene texto seleccionable (¿es un documento escaneado?). Sube un PDF exportado desde un editor.',
      );
    }

    await this.storage.save(userId, file.buffer);
    return this.save(userId, {
      cvFilename: sanitizeFilename(file.originalname),
      cvSizeBytes: file.size,
      cvPages: extracted.pages,
      cvText: extracted.text,
      cvUploadedAt: new Date(),
    });
  }

  async readCv(userId: number): Promise<{ data: Buffer; filename: string }> {
    const row = this.findRow(userId);
    if (!row?.cvFilename) throw new NotFoundException('Todavía no has subido un CV');
    return { data: await this.storage.read(userId), filename: row.cvFilename };
  }

  /** Lee el CV con IA (única llamada del módulo) y abre un borrador prellenado con el resultado. */
  async draftFromCv(userId: number): Promise<Profile> {
    const row = this.findRow(userId);
    if (!row?.cvText) throw new BadRequestException('Primero sube tu CV');

    const result = await this.llm.generate(userId, {
      system: EXTRACT_PROFILE_SYSTEM,
      prompt: extractProfilePrompt(row.cvText),
      schema: extractionSchema,
    });
    return this.save(userId, {
      draft: {
        source: 'cv',
        step: FIRST_REVIEW_STEP,
        data: withAccountEmail(result.data.profile, this.accountEmail(userId)),
        preferences: this.toProfile(row).preferences,
        recommendations: result.data.recommendations,
      },
      draftUpdatedAt: new Date(),
      generatedAt: new Date(),
      generatedProvider: result.provider,
      generatedModel: result.model,
    });
  }

  /** Abre un borrador sin IA: desde el perfil confirmado o, si no hay, uno vacío. */
  startManualDraft(userId: number): Profile {
    const current = this.toProfile(this.findRow(userId));
    const user = this.db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    return this.save(userId, {
      draft: {
        source: 'manual',
        step: FIRST_REVIEW_STEP,
        data: current.data ?? {
          ...EMPTY_PROFILE_DATA,
          fullName: user?.name ?? '',
          contact: { ...EMPTY_PROFILE_DATA.contact, email: user?.email ?? null },
        },
        preferences: current.preferences,
        recommendations: [],
      },
      draftUpdatedAt: new Date(),
    });
  }

  /** Guarda el avance del wizard (se llama en cada paso). */
  saveDraft(userId: number, draft: ProfileDraft): Profile {
    if (!this.findRow(userId)?.draft) {
      throw new BadRequestException('No hay un perfil en edición');
    }
    return this.save(userId, { draft, draftUpdatedAt: new Date() });
  }

  /** Confirma el borrador: pasa a ser el perfil que usa la evaluación de ofertas. */
  confirmDraft(userId: number): Profile {
    const draft = this.toProfile(this.findRow(userId)).draft;
    if (!draft) throw new BadRequestException('No hay un perfil en edición');
    const now = new Date();
    return this.save(userId, {
      data: draft.data,
      preferences: draft.preferences,
      confirmedAt: now,
      updatedAt: now,
      draft: null,
      draftUpdatedAt: null,
    });
  }

  discardDraft(userId: number): Profile {
    return this.save(userId, { draft: null, draftUpdatedAt: null });
  }

  private accountEmail(userId: number): string | null {
    return (
      this.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).get()?.email ??
      null
    );
  }

  private findRow(userId: number): ProfileRow | undefined {
    return this.db.select().from(profiles).where(eq(profiles.userId, userId)).get();
  }

  private save(userId: number, changes: ProfileChanges): Profile {
    const row = this.db
      .insert(profiles)
      .values({ userId, ...changes })
      .onConflictDoUpdate({ target: profiles.userId, set: changes })
      .returning()
      .get();
    return this.toProfile(row);
  }

  /**
   * Los JSON guardados se validan al leerlos: si un dato no calza con el esquema actual (ej. un
   * formato anterior), se descarta en vez de entregar datos rotos al frontend.
   */
  private toProfile(row: ProfileRow | undefined): Profile {
    const data = this.parseStored(profileDataSchema, row?.data, 'perfil', row?.userId);
    const draft = this.parseStored(profileDraftSchema, row?.draft, 'borrador', row?.userId);
    // Las preferencias se completan con los valores por defecto (por si se agregan campos nuevos).
    const preferences =
      this.parseStored(
        jobPreferencesSchema,
        row?.preferences && { ...DEFAULT_JOB_PREFERENCES, ...row.preferences },
        'preferencias',
        row?.userId,
      ) ?? DEFAULT_JOB_PREFERENCES;

    return {
      cv:
        row?.cvFilename && row.cvUploadedAt
          ? {
              filename: row.cvFilename,
              sizeBytes: row.cvSizeBytes ?? 0,
              pages: row.cvPages ?? 0,
              uploadedAt: row.cvUploadedAt.toISOString(),
            }
          : null,
      data,
      preferences,
      confirmedAt: data && row?.confirmedAt ? row.confirmedAt.toISOString() : null,
      draft:
        draft && row?.draftUpdatedAt
          ? { ...draft, updatedAt: row.draftUpdatedAt.toISOString() }
          : null,
      generated:
        row?.generatedAt && row.generatedProvider && row.generatedModel
          ? {
              at: row.generatedAt.toISOString(),
              provider: row.generatedProvider,
              model: row.generatedModel,
            }
          : null,
    };
  }

  private parseStored<T extends z.ZodType>(
    schema: T,
    value: unknown,
    label: string,
    userId: number | undefined,
  ): z.infer<T> | null {
    if (value === null || value === undefined) return null;
    const result = schema.safeParse(value);
    if (!result.success) {
      this.logger.warn(`Se ignoró ${label} guardado inválido del usuario ${userId}`);
      return null;
    }
    return result.data;
  }
}

/** Si el CV no trae correo, se propone el de la cuenta. */
function withAccountEmail(data: ProfileData, email: string | null): ProfileData {
  return data.contact.email ? data : { ...data, contact: { ...data.contact, email } };
}

/** Nombre para mostrar y descargar: sin rutas ni caracteres de control, largo acotado. */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = [...base]
    .filter((char) => char.charCodeAt(0) >= 0x20 && char !== '"')
    .join('')
    .trim()
    .slice(0, 200);
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean || 'cv'}.pdf`;
}
