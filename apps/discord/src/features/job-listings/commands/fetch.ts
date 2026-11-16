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

  const subs = await activeSubscriptions(
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
        PICKER_IDS.fetch,
        subs,
        interaction,
        "All in this channel"
      ).toJSON(),
    ],
    content: "Fetch now — all subscriptions here, or one:",
  });
};
