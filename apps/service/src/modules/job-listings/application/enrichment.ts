import type { Database } from "@kappa/db";

import type { Logger } from "../../../core/logger";
import type {
  EnrichedJobPosting,
  JobDetail,
  JobMatch,
  JobPosting,
} from "../domain/posting";
import { scoreJobMatch, summarizeJob } from "../infrastructure/ai";
import {
  readCachedSummary,
  storeCachedSummary,
} from "../infrastructure/job-store";
import { fetchJobPostingDetail } from "../infrastructure/sources";

/** Source detail, shared summary caching, and optional personal CV matching. */
export const createJobEnrichment = ({
  db,
  log,
}: {
  db: Database;
  log: Logger;
}) => {
  const detailWithCachedSummary = async (
    job: JobPosting
  ): Promise<JobDetail | null> => {
    let detail: JobDetail | null = null;
    try {
      detail = await fetchJobPostingDetail(job);
    } catch (error) {
      log.warn(
        { err: error, job: job.id, module: "job-listings" },
        "detail failed (using listing fallback)"
      );
    }
    // Prefer source detail; list rows can still carry useful text when detail fails.
    let input = detail?.description ? detail : null;
    if (!input && job.description) {
      input = {
        closed: false,
        description: job.description,
        salary: job.salary ?? null,
      };
    }
    if (!input?.description) {
      return detail;
    }
    const cached = await readCachedSummary(db, job.source, job.id);
    if (cached) {
      return { ...input, description: cached };
    }
    const summary = await summarizeJob(
      job.position,
      job.company,
      input.description,
      {
        location: job.location ?? null,
        salary: input.salary ?? job.salary ?? null,
      }
    );
    if (!summary) {
      return input;
    }
    await storeCachedSummary(log, db, job, summary);
    return { ...input, description: summary };
  };

  return {
    async enrich(
      job: JobPosting,
      cvText?: string | null
    ): Promise<EnrichedJobPosting> {
      const detail = await detailWithCachedSummary(job);
      // Personal callers explicitly supply their CV; scoring never blocks enrichment.
      let match: JobMatch | null = null;
      const cv = cvText?.trim();
      const description = detail?.description ?? job.description ?? null;
      if (cv && description) {
        match = await scoreJobMatch(
          cv,
          job.position,
          job.company,
          description,
          {
            location: job.location ?? null,
          }
        );
      }
      return { detail, job, match };
    },
  };
};
