export const JOB_SOURCES = [
  { id: "linkedin", name: "LinkedIn" },
  { id: "kalibrr", name: "Kalibrr" },
  { id: "techinasia", name: "Tech in Asia" },
  { id: "glints", name: "Glints" },
  { id: "indeed", name: "Indeed" },
  { id: "jobstreet", name: "Jobstreet" },
] as const;

export type JobSourceId = (typeof JOB_SOURCES)[number]["id"];
export type JobSourceSelection = JobSourceId | "all";
export const DEFAULT_JOB_SOURCE: JobSourceId = "linkedin";
export const JOB_SOURCE_OPTIONS = [
  { id: "all", name: "All Sources" },
  ...JOB_SOURCES,
] as const;
export const JOB_SOURCE_SELECTIONS: readonly JobSourceSelection[] =
  JOB_SOURCE_OPTIONS.map((source) => source.id);

export const jobSourceName = (source: string): string =>
  JOB_SOURCE_OPTIONS.find((option) => option.id === source)?.name ?? source;

/** Normalized posting data shared by source adapters and delivery snapshots. */
export interface JobPosting {
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
}

const listedAt = (posting: JobPosting): number => {
  const time = posting.datetime ? Date.parse(posting.datetime) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

/** Undated postings retain their input order after dated postings. */
export const sortPostingsNewestFirst = (postings: JobPosting[]): JobPosting[] =>
  postings.toSorted((a, b) => listedAt(b) - listedAt(a));
