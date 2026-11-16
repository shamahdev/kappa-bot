import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { jobActor, jobScope, requireManageGuild } from "../interactions";
import { pickerRow } from "../picker";
import { PICKER_IDS } from "../presentation";

const showPicker = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
  action: "edit" | "retry"
) => {
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
    components: [pickerRow(PICKER_IDS[action], rows, interaction).toJSON()],
    content:
      action === "edit"
        ? "Choose a subscription to edit:"
        : "Choose a subscription to retry failed extraction:",
  });
};

export const executeEdit = (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => showPicker(interaction, ctx, "edit");
export const executeRetry = (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => showPicker(interaction, ctx, "retry");
