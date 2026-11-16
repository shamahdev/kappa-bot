import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { jobActor, jobScope, requireManageGuild } from "../interactions";
import { pickerRow } from "../picker";
import { PICKER_IDS } from "../presentation";

export const executeEdit = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const rows = await ctx.jobListings.subscriptions.list(
    jobActor(interaction),
    jobScope(interaction)
  );
  if (!rows.length) {
    await interaction.editReply({
      content: "No subscriptions here yet. Try /jobs subscribe.",
    });
    return;
  }
  await interaction.editReply({
    components: [pickerRow(PICKER_IDS.edit, rows, interaction).toJSON()],
    content: "Choose a subscription to edit:",
  });
};
