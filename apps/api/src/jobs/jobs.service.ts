import type { JobSummary, SourceId } from '@job-finder/shared';
import type { JobDetail, JobListing } from '@job-finder/sources';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobs, userJobs } from '../database/schema.js';

/** Cuántas ofertas devuelve la lista. La bandeja con filtros y páginas llega con su issue. */
const LIST_LIMIT = 300;

export interface PendingDetail {
  id: number;
  externalId: string;
  url: string;
}

/**
 * Ofertas guardadas. Las ofertas son globales (una fila por oferta del portal) y cada usuario
 * tiene su propia lista con su estado (`user_jobs`).
 */
@Injectable()
export class JobsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Guarda lo que entregó una búsqueda: crea o actualiza cada oferta y la agrega a la lista del
   * usuario si no la tenía. Devuelve cuántas eran nuevas para él.
   */
  saveListings(
    userId: number,
    searchId: number,
    source: SourceId,
    listings: JobListing[],
  ): { added: number } {
    return this.db.transaction((tx) => {
      const now = new Date();
      let added = 0;
      for (const listing of listings) {
        const fields = {
          url: listing.url,
          title: listing.title,
          company: listing.company,
          location: listing.location,
          cities: listing.cities,
          countries: listing.countries,
          modality: listing.modality,
          employmentType: listing.employmentType,
          seniority: listing.seniority,
          salaryMin: listing.salary?.min ?? null,
          salaryMax: listing.salary?.max ?? null,
          salaryCurrency: listing.salary?.currency ?? null,
          salaryPeriod: listing.salary?.period ?? null,
          salaryBasis: listing.salary?.basis ?? null,
          salaryPublic: listing.salary?.public ?? null,
          publishedOn: listing.publishedOn,
          applyNotes: listing.applyNotes,
          raw: listing.raw,
          lastSeenAt: now,
        };
        const job = tx
          .insert(jobs)
          .values({ source, externalId: listing.externalId, ...fields })
          .onConflictDoUpdate({ target: [jobs.source, jobs.externalId], set: fields })
          .returning({ id: jobs.id })
          .get();
        const created = tx
          .insert(userJobs)
          .values({ userId, jobId: job.id, searchId })
          .onConflictDoNothing()
          .returning({ id: userJobs.id })
          .get();
        if (created) added += 1;
      }
      return { added };
    });
  }

  /** De las ofertas indicadas, las que todavía no tienen leída su página de detalle. */
  pendingDetails(source: SourceId, externalIds: string[], limit: number): PendingDetail[] {
    if (externalIds.length === 0 || limit === 0) return [];
    return this.db
      .select({ id: jobs.id, externalId: jobs.externalId, url: jobs.url })
      .from(jobs)
      .where(
        and(
          eq(jobs.source, source),
          inArray(jobs.externalId, externalIds),
          isNull(jobs.detailFetchedAt),
        ),
      )
      .orderBy(desc(jobs.publishedOn), jobs.id)
      .limit(limit)
      .all();
  }

  saveDetail(jobId: number, detail: JobDetail): void {
    this.db
      .update(jobs)
      .set({
        description: detail.description,
        tags: detail.tags,
        benefits: detail.benefits,
        applyUrl: detail.applyUrl,
        closed: detail.closed,
        detailFetchedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .run();
  }

  /** Ofertas del usuario, de la publicada más recientemente a la más antigua. */
  listForUser(userId: number): JobSummary[] {
    const rows = this.db
      .select({ job: jobs, status: userJobs.status, foundAt: userJobs.createdAt })
      .from(userJobs)
      .innerJoin(jobs, eq(jobs.id, userJobs.jobId))
      .where(eq(userJobs.userId, userId))
      .orderBy(desc(jobs.publishedOn), desc(jobs.id))
      .limit(LIST_LIMIT)
      .all();
    return rows.map(({ job, status, foundAt }) => ({
      id: job.id,
      source: job.source,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      modality: job.modality,
      employmentType: job.employmentType,
      seniority: job.seniority,
      salary:
        job.salaryMin === null && job.salaryMax === null
          ? null
          : {
              min: job.salaryMin,
              max: job.salaryMax,
              currency: job.salaryCurrency ?? 'USD',
              period: job.salaryPeriod ?? 'month',
              basis: job.salaryBasis,
              public: job.salaryPublic ?? false,
            },
      publishedOn: job.publishedOn,
      status,
      foundAt: foundAt.toISOString(),
    }));
  }
}
