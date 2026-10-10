import {
  EMPLOYMENT_TYPES,
  JOB_MODALITIES,
  JOB_STATUSES,
  LLM_PROVIDERS,
  PORTAL_STATUSES,
  RUN_STATUSES,
  RUN_TRIGGERS,
  SALARY_BASES,
  SALARY_PERIODS,
  SOURCE_IDS,
  type JobPreferences,
  type ProfileData,
  type ProfileDraft,
  type SearchCondition,
} from '@job-finder/shared';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  llmProvider: text('llm_provider', { enum: LLM_PROVIDERS }).notNull().default('claude-cli'),
  /** Cifrada con APP_SECRET (AES-256-GCM); nunca se devuelve completa al frontend. */
  anthropicApiKeyEnc: text('anthropic_api_key_enc'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 del token de la cookie: si se filtra la base de datos, los tokens no sirven. */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

/** Perfil profesional de cada usuario (1:1). Ver docs/arquitectura.md. */
export const profiles = sqliteTable('profiles', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cvFilename: text('cv_filename'),
  cvSizeBytes: integer('cv_size_bytes'),
  cvPages: integer('cv_pages'),
  /** Texto extraído del PDF: es lo que recibe la IA para generar el perfil. */
  cvText: text('cv_text'),
  cvUploadedAt: integer('cv_uploaded_at', { mode: 'timestamp' }),
  /** Perfil confirmado (validado con `profileDataSchema`); de aquí se arma el `profile.md`. */
  data: text('data', { mode: 'json' }).$type<ProfileData>(),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  /** Con qué IA se extrajo el último CV. */
  generatedAt: integer('generated_at', { mode: 'timestamp' }),
  generatedProvider: text('generated_provider', { enum: LLM_PROVIDERS }),
  generatedModel: text('generated_model'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  /** Wizard en curso (validado con `profileDraftSchema`); `null` si no se está editando. */
  draft: text('draft', { mode: 'json' }).$type<ProfileDraft>(),
  draftUpdatedAt: integer('draft_updated_at', { mode: 'timestamp' }),
  /** Validado con `jobPreferencesSchema`. */
  preferences: text('preferences', { mode: 'json' }).$type<JobPreferences>(),
});

/** Cuenta de un usuario en un portal de empleo. Ver ADR 0012. */
export const portalAccounts = sqliteTable(
  'portal_accounts',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source', { enum: SOURCE_IDS }).notNull(),
    /** Si el portal se revisa en las búsquedas del usuario. */
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    status: text('status', { enum: PORTAL_STATUSES }).notNull().default('disconnected'),
    /** Sesión del portal (cookies), cifrada con APP_SECRET. Da acceso a la cuenta del usuario. */
    sessionEnc: text('session_enc'),
    connectedAt: integer('connected_at', { mode: 'timestamp' }),
    checkedAt: integer('checked_at', { mode: 'timestamp' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.source] })],
);

/**
 * La búsqueda de un usuario en un portal. Por ahora hay una por portal: sus condiciones son las
 * que el usuario tiene guardadas allá (ver ADR 0013).
 */
export const searches = sqliteTable(
  'searches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source', { enum: SOURCE_IDS }).notNull(),
    /** Cada cuántas horas se repite sola. `null`: solo cuando el usuario la pide. */
    intervalHours: integer('interval_hours'),
    /** Condiciones leídas del portal en la última ejecución exitosa, en texto para mostrar. */
    conditions: text('conditions', { mode: 'json' }).$type<SearchCondition[]>(),
    conditionsReadAt: integer('conditions_read_at', { mode: 'timestamp' }),
    /** Inicio de la última ejecución; de aquí se calcula cuándo toca la siguiente. */
    lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('searches_user_source_idx').on(table.userId, table.source)],
);

/** Cada ejecución de una búsqueda, con su resultado. No se borran: son el historial. */
export const searchRuns = sqliteTable(
  'search_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    searchId: integer('search_id')
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    trigger: text('trigger', { enum: RUN_TRIGGERS }).notNull(),
    status: text('status', { enum: RUN_STATUSES }).notNull().default('running'),
    /** Qué está haciendo mientras corre. */
    step: text('step'),
    startedAt: integer('started_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    /** Ofertas que entregó el portal. */
    found: integer('found').notNull().default(0),
    /** Cuántas de esas el usuario no tenía. */
    added: integer('added').notNull().default(0),
    reachedEnd: integer('reached_end', { mode: 'boolean' }),
    warnings: text('warnings', { mode: 'json' }).$type<string[]>().notNull().default([]),
    error: text('error'),
    /** Nombres de los archivos guardados en `ARTIFACTS_DIR/<id>/` cuando la ejecución falla. */
    artifacts: text('artifacts', { mode: 'json' }).$type<string[]>().notNull().default([]),
  },
  (table) => [index('search_runs_search_id_idx').on(table.searchId)],
);

/**
 * Ofertas leídas de los portales. Son **globales**: una oferta se guarda una vez aunque la
 * encuentren las búsquedas de varios usuarios. Lo propio de cada usuario está en `user_jobs`.
 */
export const jobs = sqliteTable(
  'jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source', { enum: SOURCE_IDS }).notNull(),
    /** Id de la oferta en el portal. */
    externalId: text('external_id').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    company: text('company'),
    location: text('location'),
    cities: text('cities', { mode: 'json' }).$type<string[]>().notNull().default([]),
    countries: text('countries', { mode: 'json' }).$type<string[]>().notNull().default([]),
    modality: text('modality', { enum: JOB_MODALITIES }),
    employmentType: text('employment_type', { enum: EMPLOYMENT_TYPES }),
    seniority: text('seniority'),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency'),
    salaryPeriod: text('salary_period', { enum: SALARY_PERIODS }),
    salaryBasis: text('salary_basis', { enum: SALARY_BASES }),
    /** `false` si el portal muestra el sueldo solo a quien inició sesión. */
    salaryPublic: integer('salary_public', { mode: 'boolean' }),
    /** Día de publicación, `AAAA-MM-DD`. */
    publishedOn: text('published_on'),
    applyNotes: text('apply_notes', { mode: 'json' }).$type<string[]>().notNull().default([]),
    /** La oferta tal como la entregó el portal, para reprocesarla sin volver a leerlo. */
    raw: text('raw', { mode: 'json' }).$type<unknown>(),
    // Lo siguiente viene de la página de la oferta, que se lee después del listado.
    description: text('description'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    benefits: text('benefits', { mode: 'json' }).$type<string[]>().notNull().default([]),
    applyUrl: text('apply_url'),
    closed: integer('closed', { mode: 'boolean' }).notNull().default(false),
    detailFetchedAt: integer('detail_fetched_at', { mode: 'timestamp' }),
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('jobs_source_external_id_idx').on(table.source, table.externalId)],
);

/** Una oferta en la lista de un usuario: su estado y sus notas. */
export const userJobs = sqliteTable(
  'user_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: integer('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    /** Búsqueda que la encontró primero. */
    searchId: integer('search_id').references(() => searches.id, { onDelete: 'set null' }),
    status: text('status', { enum: JOB_STATUSES }).notNull().default('new'),
    notes: text('notes'),
    appliedAt: integer('applied_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_jobs_user_job_idx').on(table.userId, table.jobId),
    index('user_jobs_user_status_idx').on(table.userId, table.status),
  ],
);
