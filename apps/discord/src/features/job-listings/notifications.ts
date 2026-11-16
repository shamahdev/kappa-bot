import { WEB_ROUTES } from "@kappa/contracts";
import type { JobNotifications } from "@kappa/service/job-listings";
import { REST, Routes } from "discord.js";

import type { AppConfig } from "../../core/config";
import type { DeliverMessage, MessagePayload } from "../../core/feature";
import { cardPayload, deliveryPages } from "./embed";

export const roleNotification = (
  payload: MessagePayload,
  roleId?: string | null
): MessagePayload => ({
  ...payload,
  allowed_mentions: {
    parse: [],
    replied_user: false,
    roles: roleId ? [roleId] : [],
    users: [],
  },
  ...(roleId
    ? {
        content: `<@&${roleId}>${payload.content ? `\n${payload.content}` : ""}`,
      }
    : {}),
});

/** Discord transport only; the application records recall/counts after each successful yield. */
export const createDiscordNotifications = (
  deliverMessage: DeliverMessage,
  { webUrl, discordToken }: Pick<AppConfig, "webUrl" | "discordToken">
): JobNotifications => {
  const rest = new REST({ version: "10" }).setToken(discordToken);
  return {
    async *batch(channelId, jobs, keyword, roleId) {
      let firstPage = true;
      for (const page of deliveryPages(jobs, keyword)) {
        // Each send must finish before yielding its receipt; later pages stay lazy and ordered.
        // oxlint-disable-next-line no-await-in-loop
        const sent = await deliverMessage(
          channelId,
          roleNotification(page.payload, firstPage ? roleId : null)
        );
        firstPage = false;
        yield { jobs: page.jobs, messageId: sent.messageId };
      }
    },
    async card(channelId, posting, keyword, roleId) {
      await deliverMessage(
        channelId,
        roleNotification(cardPayload(posting, keyword), roleId)
      );
    },
    async report(userId, reportId, grade) {
      if (!webUrl || !discordToken) {
        throw new Error(
          "WEB_URL and DISCORD_TOKEN are required for CV report notifications"
        );
      }
      // Reports always go to the owner's bot DM, never a subscription's shared channel.
      const channel = (await rest.post(Routes.userChannels(), {
        body: { recipient_id: userId },
      })) as { id: string };
      const link = new URL(WEB_ROUTES.report(reportId), webUrl).toString();
      await deliverMessage(channel.id, {
        content: `CV score: **${grade}**\n${link}`,
      });
    },
  };
};
