import { subscriptionDisplayTitle } from "@kappa/service/job-listings";
import type { JobSubscription, PollResult } from "@kappa/service/job-listings";
import { EmbedBuilder } from "discord.js";

export const EMBED_COLOR = 0x3f_6b_55;
export const ERROR_COLOR = 0xe5_48_4d;

export const PICKER_IDS = {
  edit: "jobs:edit",
  fetch: "jobs:fetch",
  latest: "jobs:latest",
  unsub: "jobs:unsub",
} as const;

export const subscriptionLine = (s: JobSubscription): string =>
  `${s.isActive ? "Active" : "Inactive"} · \`${s.source}\` ${subscriptionDisplayTitle(s)}${s.title ? ` (${s.keywords})` : ""}${s.location ? ` · ${s.location}` : ""}${s.workEnvironments?.length ? ` · ${s.workEnvironments.join(", ")}` : ""}${s.minimumSalary === null || s.minimumSalary === undefined ? "" : ` · ≥ IDR ${s.minimumSalary.toLocaleString("id-ID")}/month (advertised upper pay)`}${s.roleId && !s.guildId.startsWith("dm:") ? ` · tag <@&${s.roleId}>` : ""} → <#${s.channelId}>`;

export const fetchResultEmbed = (result: PollResult): EmbedBuilder => {
  const timeFormatted = (result.durationMs / 1000).toFixed(2);
  const subText =
    result.subscriptionsCount === 1
      ? "1 subscription"
      : `${result.subscriptionsCount} subscriptions`;
  const jobText =
    result.newJobsDelivered === 1
      ? "1 new job"
      : `${result.newJobsDelivered} new jobs`;
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("Manual fetch complete")
    .setDescription(
      [
        `Polled **${subText}**`,
        `Delivered **${jobText}** to subscribed channels`,
        `Completed in **${timeFormatted}s**`,
        ...(result.pendingEvaluations || result.failedEvaluations
          ? [
              `Extraction: ${result.pendingEvaluations ?? 0} pending, ${result.failedEvaluations ?? 0} failed`,
            ]
          : []),
        ...(result.extractionUnavailable ? [result.extractionUnavailable] : []),
      ].join("\n")
    );
};

export const removedEmbed = (summary: string): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `Removed subscription (${summary}). Past deliveries stay deleted with it.`
    );
