import type { JobMatchType, JobPosting } from "@kappa/contracts";

export type { JobPosting } from "@kappa/contracts";

export interface FingerprintQuery {
  keywords: string;
  location?: string | null;
  geoId?: string | null;
  distance?: number | null;
  filters: Record<string, string>;
}

/** Enrichment from a source detail endpoint or listing row. */
export interface JobDetail {
  // Plain text or a cached markdown summary.
  description: string | null;
  // Only when the employer publishes a pay range.
  salary: string | null;
  /** Detail page banner says the posting no longer accepts applications. */
  closed: boolean;
}

/** Weighted factor assessment shared by service, web and Discord. */
export type JobMatch = JobMatchType;

/** Transport-neutral enrichment for one posting. */
export interface EnrichedJobPosting {
  job: JobPosting;
  detail: JobDetail | null;
  match: JobMatch | null;
}
