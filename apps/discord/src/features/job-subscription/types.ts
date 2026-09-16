// JobPosting lives in @kappa/db (schema's jsonb $type); re-exported here so
// existing adapter/embed imports keep working unchanged.
export type { JobPosting } from '@kappa/db';

export type FingerprintQuery = {
  keywords: string;
  location?: string | null;
  geoId?: string | null;
  distance?: number | null;
  filters: Record<string, string>;
};

/** Enrichment from the guest detail endpoint (research-01 §2.2). */
export type JobDetail = {
  description: string | null; // plain text, truncated by the renderer
  salary: string | null; // only when the employer publishes a pay range
  /** Detail page banner says the posting no longer accepts applications. */
  closed: boolean;
};

