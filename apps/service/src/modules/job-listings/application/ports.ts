import type { Database } from "@kappa/db";

import type { Logger } from "../../../core/logger";
import type { EnrichedJobPosting, JobPosting } from "../domain/posting";
import type { createCvProfiles } from "./cv";
import type { createJobEnrichment } from "./enrichment";
import type { createDeliveryRecall } from "./recall";

/** A batch yields only after each transport page has actually been sent. */
export interface JobNotifications {
  card: (
    channelId: string,
    posting: EnrichedJobPosting,
    keyword?: string | null
  ) => Promise<void>;
  batch: (
    channelId: string,
    jobs: JobPosting[],
    keyword?: string | null
  ) => AsyncIterable<{
    messageId?: string;
    jobs: JobPosting[];
  }>;
}

export interface JobPollingContext {
  db: Database;
  log: Logger;
  notifications: JobNotifications;
  cv: ReturnType<typeof createCvProfiles>;
  enrichment: ReturnType<typeof createJobEnrichment>;
  recall: ReturnType<typeof createDeliveryRecall>;
}
