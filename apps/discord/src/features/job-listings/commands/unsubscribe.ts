import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { activeGuildSubs, pickerRow } from "./_pick";
import { errorEmbed, jobActor, jobScope, requireManageGuild } from "./_shared";

export const executeUnsubscribe = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  await interaction.deferReply();
  const subs = await activeGuildSubs(
    ctx,
    jobActor(interaction),
    jobScope(interaction)
  );
  if (!subs.length) {
    await interaction.editReply({
      embeds: [errorEmbed("No active subscriptions here.")],
    });
    return;
  }
  await interaction.editReply({
    components: [pickerRow("jobs:unsub", subs, interaction).toJSON()],
    content: "Pick a subscription to remove:",
  });
};

export const removedEmbed = (summary: string): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(0x3f_6b_55)
    .setDescription(
      `Removed subscription (${summary}). Past deliveries stay deleted with it.`
    );
