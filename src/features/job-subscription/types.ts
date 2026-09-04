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
};

/** AI enrichment over the detail description (feature-local ai.ts). */
export type JobAiSummary = {
  summary: string;
  /** Condensed responsibilities/requirements — replaces the raw description in embeds. */
  details: string | null;
  seniority: string | null;
  employmentType: string | null;
  workMode: string | null; // onsite | remote | hybrid
  skills: string[];
  salary: string | null; // extracted from the description text, if stated
};
