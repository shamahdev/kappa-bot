// Unified Source Adapter registry for all job sources.
import type { FingerprintQuery, JobDetail, JobPosting } from '../types';
import { linkedinCircuitCount, fetchDetail as fetchLinkedInDetail, searchLinkedIn } from './linkedin';
import { searchKalibrr } from './kalibrr';
import { searchTechInAsia } from './techinasia';
import { searchGlints, ENV as GLINTS_ENV } from './glints';
import { searchIndeed, ENV as INDEED_ENV } from './indeed';
import { searchJobstreet, ENV as JOBSTREET_ENV } from './jobstreet';

export { linkedinCircuitCount };

export const CONCRETE_SOURCES = ['linkedin', 'kalibrr', 'techinasia'] as const;
export type ConcreteSource = (typeof CONCRETE_SOURCES)[number];

/**
 * Cookie-gated opt-in sources (fetch + persisted WAF-challenge cookies, no
 * browser). Each call throws a clear error until its cookies env var is set.
 */
export const OPT_IN_SOURCES = ['glints', 'indeed', 'jobstreet'] as const;
export type OptInSource = (typeof OPT_IN_SOURCES)[number];

/** Cookie env var per opt-in source (single owner; health.ts reads these). */
export const SOURCE_COOKIE_ENV: Record<OptInSource, string> = {
  glints: GLINTS_ENV,
  indeed: INDEED_ENV,
  jobstreet: JOBSTREET_ENV,
};

export const SUPPORTED_SOURCES = ['all', ...CONCRETE_SOURCES, ...OPT_IN_SOURCES] as const;
export type SupportedSource = (typeof SUPPORTED_SOURCES)[number];

export function isSupportedSource(source: string): source is SupportedSource {
  return (SUPPORTED_SOURCES as readonly string[]).includes(source);
}

/**
 * Sources polled for `source='all'`: concrete always, plus each opt-in source
 * whose cookies are configured. Missing-cookie sources are skipped before any
 * network call; expired cookies still fail per-fingerprint at poll time and
 * are logged without stopping the tick.
 */
export function pollSources(env: Record<string, string | undefined> = process.env): string[] {
  return [
    ...CONCRETE_SOURCES,
    ...OPT_IN_SOURCES.filter((s) => (env[SOURCE_COOKIE_ENV[s]] ?? '').trim() !== ''),
  ];
}

type SourceSearch = (query: FingerprintQuery, fingerprint: string) => Promise<JobPosting[]>;
type SourceDetail = (job: JobPosting) => Promise<JobDetail | null>;

/** Detail passthrough for adapters whose list rows already carry it (all but LinkedIn). */
function rowDetail(job: JobPosting): Promise<JobDetail | null> {
  return Promise.resolve({
    description: job.description ?? null,
    salary: job.salary ?? null,
    closed: false,
  });
}

/**
 * One shared table behind the JobSource seam: adding a Source Adapter touches
 * this record only, not a switch plus an if-chain plus a display-name map.
 */
const SOURCE_ADAPTERS: Record<ConcreteSource | OptInSource, { search: SourceSearch; detail: SourceDetail }> = {
  linkedin: { search: searchLinkedIn, detail: (job) => fetchLinkedInDetail(job.id) },
  kalibrr: { search: searchKalibrr, detail: rowDetail },
  techinasia: { search: searchTechInAsia, detail: rowDetail },
  glints: { search: searchGlints, detail: rowDetail },
  indeed: { search: searchIndeed, detail: rowDetail },
  jobstreet: { search: searchJobstreet, detail: rowDetail },
};

function implFor(source: string): { search: SourceSearch; detail: SourceDetail } {
  return (
    (SOURCE_ADAPTERS as Record<string, { search: SourceSearch; detail: SourceDetail }>)[source] ??
    SOURCE_ADAPTERS.linkedin
  );
}

export async function searchJobPostings(
  source: string,
  query: FingerprintQuery,
  fingerprint: string,
): Promise<JobPosting[]> {
  return implFor(source).search(query, fingerprint);
}

export async function fetchJobPostingDetail(job: JobPosting): Promise<JobDetail | null> {
  return implFor(job.source).detail(job);
}
