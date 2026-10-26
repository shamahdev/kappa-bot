import { useEffect, useState } from "react";

import { useJobs } from "./queries";
import type { JobsParams } from "./queries";

// Retain the existing Jobs UI pagination and search debounce settings.
const PAGE_SIZE = 20;
export const ALL_SOURCES = "All sources";
export type JobsBase = { scope: "dm" } | { guild: string };

export interface JobsFilters {
  q: string;
  source: string;
  subscriptionId: number | null;
}

export const jobsParams = (
  base: JobsBase,
  filters: JobsFilters,
  page: number
): JobsParams => ({
  ...base,
  q: filters.q.trim() === "" ? undefined : filters.q.trim(),
  source: filters.source === ALL_SOURCES ? undefined : filters.source,
  subscription: filters.subscriptionId ?? undefined,
  page,
  pageSize: PAGE_SIZE,
});

const useDebouncedValue = (value: string, delayMs: number): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

/** Coordinates filters, query, paging and row expansion using stable identities. */
export const useJobsTable = (base: JobsBase) => {
  const [q, setQ] = useState("");
  const [source, setSource] = useState(ALL_SOURCES);
  const [subscriptionId, setSubscriptionId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [expandedSummaryId, setExpandedSummaryId] = useState<number | null>(
    null
  );
  const debouncedQ = useDebouncedValue(q, 300);

  const [previousFilters, setPreviousFilters] = useState({
    q: debouncedQ,
    source,
    subscriptionId,
  });
  if (
    previousFilters.q !== debouncedQ ||
    previousFilters.source !== source ||
    previousFilters.subscriptionId !== subscriptionId
  ) {
    setPreviousFilters({ q: debouncedQ, source, subscriptionId });
    setPage(1);
  }

  const jobs = useJobs(
    true,
    jobsParams(base, { q: debouncedQ, source, subscriptionId }, page)
  );
  const total = jobs.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const clearFilters = () => {
    setQ("");
    setSource(ALL_SOURCES);
    setSubscriptionId(null);
  };

  return {
    q,
    setQ,
    source,
    setSource,
    subscriptionId,
    // Select values are option IDs, never the mutable display labels.
    selectSubscription: (value: string) =>
      setSubscriptionId(value === "" ? null : Number(value)),
    page,
    previousPage: () => setPage((previous) => previous - 1),
    nextPage: () => setPage((previous) => previous + 1),
    expandedSummaryId,
    toggleSummary: (id: number) =>
      setExpandedSummaryId((previous) => (previous === id ? null : id)),
    jobs,
    total,
    totalPages,
    filtered:
      debouncedQ !== "" || source !== ALL_SOURCES || subscriptionId !== null,
    clearFilters,
  };
};
