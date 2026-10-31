import type { JobNotifications } from "@kappa/service/job-listings";
import { REST, Routes } from "discord.js";

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
  async report(userId, reportId, grade) {
    const webUrl = process.env.WEB_URL;
    const token = process.env.DISCORD_TOKEN;
    if (!webUrl || !token) {
      throw new Error(
        "WEB_URL and DISCORD_TOKEN are required for CV report notifications"
      );
    }
    const rest = new REST({ version: "10" }).setToken(token);
    // Reports always go to the owner's bot DM, never a subscription's shared channel.
    const channel = (await rest.post(Routes.userChannels(), {
      body: { recipient_id: userId },
    })) as { id: string };
    const link = new URL(`/dashboard/reports/${reportId}`, webUrl).toString();
    await deliverMessage(channel.id, {
      content: `CV score: **${grade}**\n${link}`,
    });
  },
});
