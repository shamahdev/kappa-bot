// Shared domain types owned by @kappa/db (moved from the discord feature so
// the drizzle schema's jsonb $type annotations resolve inside this package).

export type JobPosting = {
  /** Stable dedup id: LinkedIn numeric urn id. */
  id: string;
  source: string;
  position: string;
  company: string;
  location: string;
  datetime: string | null;
  agoTime: string;
  salary: string | null;
  url: string;
  logo: string | null;
  description?: string | null;
};
