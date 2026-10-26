// Unified Source Adapter registry for all job sources.
import { JOB_SOURCE_SELECTIONS, JOB_SOURCES } from "@kappa/contracts";
import type { JobSourceId, JobSourceSelection } from "@kappa/contracts";

import type {
  FingerprintQuery,
  JobDetail,
  JobPosting,
} from "../../domain/posting";
import { ENV as GLINTS_ENV, searchGlints } from "./glints";
import { ENV as INDEED_ENV, searchIndeed } from "./indeed";
import { ENV as JOBSTREET_ENV, searchJobstreet } from "./jobstreet";
import { searchKalibrr } from "./kalibrr";
import { fetchDetail as fetchLinkedInDetail, searchLinkedIn } from "./linkedin";
import { searchTechInAsia } from "./techinasia";

export { linkedinCircuitCount } from "./linkedin";

/** Cookie env var per opt-in source; the remaining canonical sources are always on. */
export const SOURCE_COOKIE_ENV = {
  glints: GLINTS_ENV,
  indeed: INDEED_ENV,
  jobstreet: JOBSTREET_ENV,
} satisfies Partial<Record<JobSourceId, string>>;
export type OptInSource = keyof typeof SOURCE_COOKIE_ENV;
export type ConcreteSource = Exclude<JobSourceId, OptInSource>;

const isOptInSource = (source: JobSourceId): source is OptInSource =>
  Object.hasOwn(SOURCE_COOKIE_ENV, source);

/** Always-on sources; cookie opt-ins retain their separate enablement rules. */
export const CONCRETE_SOURCES = JOB_SOURCES.map((source) => source.id).filter(
  (source): source is ConcreteSource => !isOptInSource(source)
);
export const OPT_IN_SOURCES = JOB_SOURCES.map((source) => source.id).filter(
  isOptInSource
);

export const SUPPORTED_SOURCES = JOB_SOURCE_SELECTIONS;
export type SupportedSource = JobSourceSelection;

export const isSupportedSource = (source: string): source is SupportedSource =>
  (SUPPORTED_SOURCES as readonly string[]).includes(source);

/**
 * Sources polled for `source='all'`: concrete always, plus each opt-in source
 * whose cookies are configured. Missing-cookie sources are skipped before any
 * network call; expired cookies still fail per-fingerprint at poll time and
 * are logged without stopping the tick.
 */
export const pollSources = (
  env: Record<string, string | undefined> = process.env
): JobSourceId[] => [
  ...CONCRETE_SOURCES,
  ...OPT_IN_SOURCES.filter(
    (s) => (env[SOURCE_COOKIE_ENV[s]] ?? "").trim() !== ""
  ),
];

type SourceSearch = (
  query: FingerprintQuery,
  fingerprint: string
) => Promise<JobPosting[]>;
type SourceDetail = (job: JobPosting) => Promise<JobDetail | null>;

/** Detail passthrough for adapters whose list rows already carry it (all but LinkedIn). */
const rowDetail = (job: JobPosting): Promise<JobDetail | null> =>
  Promise.resolve({
    closed: false,
    description: job.description ?? null,
    salary: job.salary ?? null,
  });

/** Concrete integrations; selection expansion and public source metadata are separate. */
const SOURCE_ADAPTERS: Record<
  JobSourceId,
  { search: SourceSearch; detail: SourceDetail }
> = {
  glints: { detail: rowDetail, search: searchGlints },
  indeed: { detail: rowDetail, search: searchIndeed },
  jobstreet: { detail: rowDetail, search: searchJobstreet },
  kalibrr: { detail: rowDetail, search: searchKalibrr },
  linkedin: {
    detail: (job) => fetchLinkedInDetail(job.id),
    search: searchLinkedIn,
  },
  techinasia: { detail: rowDetail, search: searchTechInAsia },
};

const isSourceId = (source: string): source is JobSourceId =>
  JOB_SOURCES.some((entry) => entry.id === source);

const implFor = (
  source: string
): {
  search: SourceSearch;
  detail: SourceDetail;
} => {
  if (!isSourceId(source)) {
    throw new Error(`Unknown concrete job source: ${source}`);
  }
  return SOURCE_ADAPTERS[source];
};

/** Pure selection expansion; only `all` applies cookie-based enablement. */
export const resolveSourceSelection = (
  source: string,
  env: Record<string, string | undefined> = process.env
): JobSourceId[] => {
  if (source === "all") {
    return pollSources(env);
  }
  if (!isSourceId(source)) {
    throw new Error(`Unknown concrete job source: ${source}`);
  }
  return [source];
};

export const searchJobPostings = async (
  source: string,
  query: FingerprintQuery,
  fingerprint: string
): Promise<JobPosting[]> => await implFor(source).search(query, fingerprint);

export interface SourceSelectionOptions {
  search?: typeof searchJobPostings;
  env?: Record<string, string | undefined>;
  onSourceError?: (source: JobSourceId, error: unknown) => void;
}

/**
 * Search a selection, isolating each enabled source's failures for `all`, as
 * polling does. A direct source search keeps its provider errors observable.
 */
export const searchSelection = async (
  source: string,
  query: FingerprintQuery,
  key: string,
  options: SourceSelectionOptions = {}
): Promise<JobPosting[]> => {
  const selected = resolveSourceSelection(source, options.env);
  const search = options.search ?? searchJobPostings;
  if (source !== "all") {
    return search(source, query, key);
  }
  const jobs: JobPosting[] = [];
  for (const concreteSource of selected) {
    try {
      // Preserve source order and avoid overlapping external provider searches.
      // oxlint-disable-next-line no-await-in-loop
      jobs.push(...(await search(concreteSource, query, key)));
    } catch (error) {
      options.onSourceError?.(concreteSource, error);
    }
  }
  return jobs;
};

/** Detail always requires the posting's concrete identity, never a selection. */
export const fetchJobPostingDetail = async (
  job: JobPosting
): Promise<JobDetail | null> => await implFor(job.source).detail(job);
