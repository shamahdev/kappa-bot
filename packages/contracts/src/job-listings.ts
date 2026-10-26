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
