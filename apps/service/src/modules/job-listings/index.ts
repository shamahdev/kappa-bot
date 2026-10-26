import type { Database } from "@kappa/db";

import type { Logger } from "../../core/logger";
import { createCvProfiles } from "./application/cv";
import { createJobEnrichment } from "./application/enrichment";
import { pollSubscriptions } from "./application/polling";
import type { JobNotifications } from "./application/ports";
import { createDeliveryRecall } from "./application/recall";
import { sourceHealth } from "./application/source-health";
import { createJobSubscriptions } from "./application/subscriptions";
import type { JobActor, JobScope } from "./domain/subscription";
import { searchSelection } from "./infrastructure/sources";

export { CV_MAX_UPLOAD_BYTES, cvFilenameError } from "./application/cv";
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

const timestamp = (value: string | null) =>
  value
    ? Date.parse(value) || Number.NEGATIVE_INFINITY
    : Number.NEGATIVE_INFINITY;

/** No listeners or connections are created by importing this module. */
export const createJobListings = (deps: {
  db: Database;
  log: Logger;
  notifications: JobNotifications;
}) => {
  const subscriptions = createJobSubscriptions(deps.db);
  const cv = createCvProfiles(deps.db);
  const enrichment = createJobEnrichment(deps);
  const recall = createDeliveryRecall({ ...deps, cv, enrichment });
  const polling = { ...deps, cv, enrichment, recall };

  return {
    cv,
    async latest(actor: JobActor, id: number) {
      const sub = await subscriptions.get(actor, id);
      const jobs = await searchSelection(
        sub.source,
        {
          distance: sub.distance,
          filters: sub.filters,
          geoId: sub.geoId,
          keywords: sub.keywords ?? "",
          location: sub.location,
        },
        `latest:${sub.id}`
      );
      const [newest] = jobs.toSorted(
        (a, b) => timestamp(b.datetime) - timestamp(a.datetime)
      );
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
