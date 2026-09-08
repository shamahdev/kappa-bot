// JobPosting shape all adapters normalize to (CONTEXT.md: Source Adapter).

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

