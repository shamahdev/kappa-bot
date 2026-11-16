import { sortPostingsNewestFirst } from "@kappa/contracts";
import type { Database, GenerationLock } from "@kappa/db";

import type { Logger } from "../../core/logger";
import { createCvProfiles } from "./application/cv";
import { createCvReports } from "./application/cv-reports";
import { createJobEnrichment } from "./application/enrichment";
import { pollSubscriptions } from "./application/polling";
import type { JobNotifications } from "./application/ports";
import { createPostingEvaluation } from "./application/posting-evaluation";
import { createDeliveryRecall } from "./application/recall";
import { sourceHealth } from "./application/source-health";
import { createJobSubscriptions } from "./application/subscriptions";
import type { JobActor, JobScope } from "./domain/subscription";
import {
  JobSubscriptionError,
  postingQueryForSubscription,
  keywordAlternativesForSubscription,
  hasPostingFilters,
} from "./domain/subscription";
import { searchSelection } from "./infrastructure/sources";
import {
  keywordTokens,
  matchesKeywords,
} from "./infrastructure/sources/shared";

export type { PollResult } from "./application/polling";
export type { JobNotifications } from "./application/ports";
export { createJobPollingSchedule } from "./application/scheduler";
export type { SourceHealth } from "./application/source-health";
export type {
  EnrichedJobPosting,
  JobDetail,
  JobMatch,
  JobPosting,
} from "./domain/posting";
export type {
  JobActor,
  JobScope,
  JobSubscription,
  JobSubscriptionPatch,
} from "./domain/subscription";
export { JobSubscriptionError } from "./domain/subscription";
export { subscriptionDisplayTitle } from "./domain/subscription";

/** No listeners or connections are created by importing this module. */
export const createJobListings = (deps: {
  db: Database;
  lock?: GenerationLock;
  log: Logger;
  notifications: JobNotifications;
}) => {
  const subscriptions = createJobSubscriptions(deps.db);
  const evaluation = createPostingEvaluation(
    deps.db,
    deps.log,
    subscriptions.get
  );
  const cv = createCvProfiles(deps.db);
  const enrichment = createJobEnrichment(deps);
  const recall = createDeliveryRecall({ ...deps, cv, enrichment });
  const reports = createCvReports({
    ...deps,
    enrichment,
    notify: deps.notifications.report,
  });
  const polling = { ...deps, cv, enrichment, evaluation, recall, reports };

  return {
    cv,
    evaluation,
    async latest(actor: JobActor, id: number) {
      const sub = await subscriptions.get(actor, id);
      const found = [];
      let completedSearches = 0;
      for (const keyword of keywordAlternativesForSubscription(sub)) {
        try {
          // Alternative searches share the same provider rate-limit policy as polling.
          // oxlint-disable-next-line no-await-in-loop
          const results = await searchSelection(
            sub.source,
            { ...postingQueryForSubscription(sub), keywords: keyword },
            `latest:${sub.id}:${keyword}`
          );
          found.push(
            ...(sub.keywordAlternatives === null ||
            sub.keywordAlternatives === undefined
              ? results
              : results.filter((job) =>
                  matchesKeywords(
                    keywordTokens(keyword),
                    `${job.position} ${job.company} ${job.description ?? ""}`
                  )
                ))
          );
          completedSearches += 1;
        } catch (error) {
          deps.log.warn(
            { err: error, sub: sub.id },
            "latest alternative search failed"
          );
        }
      }
      if (completedSearches === 0) {
        throw new JobSubscriptionError(
          "VALIDATION",
          "Job sources are unavailable. Try again later."
        );
      }
      let jobs = [
        ...new Map(
          found.map((job) => [`${job.source}:${job.id}`, job])
        ).values(),
      ];
      if (hasPostingFilters(sub)) {
        await evaluation.enqueue(sub, jobs);
        const evaluated = await evaluation.process([sub], {
          candidates: jobs,
          includeSeen: true,
        });
        jobs = evaluated.get(sub.id) ?? [];
        if (!jobs.length) {
          const statuses = await evaluation.statuses([sub]);
          const status = statuses.get(sub.id);
          if (status?.pending || status?.failed || status?.unavailable) {
            throw new JobSubscriptionError(
              "VALIDATION",
              status.unavailable ??
                `Posting evaluation: ${status.pending} pending, ${status.failed} failed. Try again later or retry failed extraction.`
            );
          }
        }
      }
      const [newest] = sortPostingsNewestFirst(jobs);
      if (!newest) {
        return null;
      }
      return enrichment.enrich(newest, await cv.textForScope(sub.guildId));
    },
    async poll(
      actor: JobActor,
      input: { scope: JobScope; channelId: string; subscriptionId?: number }
    ) {
      const rows = await subscriptions.list(
        actor,
        input.scope,
        input.channelId
      );
      if (input.subscriptionId !== undefined) {
        await subscriptions.get(actor, input.subscriptionId);
      }
      const targets = rows.filter(
        (row) =>
          row.isActive &&
          (input.subscriptionId === undefined ||
            row.id === input.subscriptionId)
      );
      return pollSubscriptions(polling, targets);
    },
    pollAll: () => pollSubscriptions(polling),
    replyDetail: recall.detail,
    sourceHealth,
    subscriptions,
  };
};

export type JobListings = ReturnType<typeof createJobListings>;
