import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import {
  errorEmbed,
  jobActor,
  jobScope,
  requireManageGuild,
} from "../interactions";
import { activeSubscriptions, pickerRow } from "../picker";
import { PICKER_IDS } from "../presentation";

export const executeUnsubscribe = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  await interaction.deferReply();
  const subs = await activeSubscriptions(
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
    components: [pickerRow(PICKER_IDS.unsub, subs, interaction).toJSON()],
    content: "Pick a subscription to remove:",
  });
};
