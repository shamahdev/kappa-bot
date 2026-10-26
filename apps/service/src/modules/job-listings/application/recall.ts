import { channels, deliveryMessages } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, eq } from "drizzle-orm";

import type { Logger } from "../../../core/logger";
import type { JobPosting } from "../domain/posting";
import { dmScopeKey } from "../domain/subscription";
import { storeMatchScoreForChannelDelivery } from "../infrastructure/job-store";
import type { createCvProfiles } from "./cv";
import type { createJobEnrichment } from "./enrichment";

interface RecallDeps {
  db: Database;
  log: Logger;
  cv: ReturnType<typeof createCvProfiles>;
  enrichment: ReturnType<typeof createJobEnrichment>;
}

export const createDeliveryRecall = ({
  db,
  log,
  cv,
  enrichment,
}: RecallDeps) => ({
  async detail(input: {
    messageId: string;
    channelId: string;
    index: number;
    userId?: string;
  }) {
    if (!Number.isSafeInteger(input.index) || input.index < 1) {
      return null;
    }
    const [delivery] = await db
      .select()
      .from(deliveryMessages)
      .where(
        and(
          eq(deliveryMessages.messageId, input.messageId),
          eq(deliveryMessages.channelId, input.channelId)
        )
      );
    const job = delivery?.jobs[input.index - 1];
    if (!(delivery && job)) {
      return null;
    }
    let cvText: string | null = null;
    if (input.userId) {
      const [channel] = await db
        .select({ scope: channels.guildId })
        .from(channels)
        .where(eq(channels.id, input.channelId));
      if (channel?.scope === dmScopeKey(input.userId)) {
        cvText = await cv.textForScope(channel.scope);
      }
    }
    const posting = await enrichment.enrich(job, cvText);
    if (posting.match && input.userId && cvText) {
      await storeMatchScoreForChannelDelivery(log, db, {
        channelId: input.channelId,
        externalId: job.id,
        match: posting.match,
        source: job.source,
        userId: input.userId,
      });
    }
    return { keyword: delivery.keyword, posting };
  },
  async record(
    channelId: string,
    messageId: string,
    jobs: JobPosting[],
    keyword?: string | null
  ) {
    try {
      await db
        .insert(deliveryMessages)
        .values({ channelId, jobs, keyword: keyword ?? null, messageId })
        .onConflictDoUpdate({
          set: {
            channelId,
            createdAt: new Date(),
            jobs,
            keyword: keyword ?? null,
          },
          target: deliveryMessages.messageId,
        });
    } catch (error) {
      log.warn({ error, messageId }, "delivery recall persistence failed");
    }
  },
});
