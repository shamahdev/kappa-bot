import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { activeChannelSubs, pickerRow } from "./_pick";
import { errorEmbed, jobActor, jobScope, requireManageGuild } from "./_shared";

export const executeShowLatest = async (
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
  if (!subs.length) {
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
    components: [pickerRow("jobs:latest", subs, interaction).toJSON()],
    content: "Show the latest job for:",
  });
};
