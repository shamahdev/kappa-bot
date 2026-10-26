import type { JobNotifications } from "@kappa/service/job-listings";

import type { DeliverMessage } from "../../core/feature";
import { cardPayload, deliveryPages } from "./embed";

/** Discord transport only; the application records recall/counts after each successful yield. */
export const createDiscordNotifications = (
  deliverMessage: DeliverMessage
): JobNotifications => ({
  async *batch(channelId, jobs, keyword) {
    for (const page of deliveryPages(jobs, keyword)) {
      // Each send must finish before yielding its receipt; later pages stay lazy and ordered.
      // oxlint-disable-next-line no-await-in-loop
      const sent = await deliverMessage(channelId, page.payload);
      yield { jobs: page.jobs, messageId: sent.messageId };
    }
  },
  async card(channelId, posting, keyword) {
    await deliverMessage(channelId, cardPayload(posting, keyword));
  },
});
