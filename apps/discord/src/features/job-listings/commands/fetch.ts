import type { PollResult } from "@kappa/service/job-listings";
import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { activeChannelSubs, pickerRow } from "./_pick";
import { errorEmbed, jobActor, jobScope, requireManageGuild } from "./_shared";

export const executeFetch = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  if (!interaction.channelId) {
    await interaction.reply({
      content: "Run this inside a server channel or DM.",
    });
    return;
  }

  await interaction.deferReply();

  const subs = await activeChannelSubs(
    ctx,
    jobActor(interaction),
    jobScope(interaction),
    interaction.channelId
  );
  if (subs.length === 0) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          "No active subscriptions in this channel. Try `/jobs subscribe`."
        ),
      ],
    });
    return;
  }
  await interaction.editReply({
    components: [
      pickerRow(
        "jobs:fetch",
        subs,
        interaction,
        "All in this channel"
      ).toJSON(),
    ],
    content: "Fetch now — all subscriptions here, or one:",
  });
};

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
    .setColor(0x3f_6b_55)
    .setTitle("Manual fetch complete")
    .setDescription(
      [
        `Polled **${subText}**`,
        `Delivered **${jobText}** to subscribed channels`,
        `Completed in **${timeFormatted}s**`,
      ].join("\n")
    );
};
