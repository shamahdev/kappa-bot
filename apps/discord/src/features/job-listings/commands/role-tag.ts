import { JobSubscriptionError } from "@kappa/service/job-listings";
import type {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import {
  applicationErrorMessage,
  errorEmbed,
  jobActor,
  jobScope,
  requireManageGuild,
} from "../interactions";
import { pickerRow } from "../picker";

export const executeRoleTag = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!interaction.guildId) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "Role tags are only available for server subscriptions."
    );
  }
  if (!(await requireManageGuild(interaction))) {
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const role = interaction.options.getRole("role");
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
    components: [
      pickerRow(`jobs:role:${role?.id ?? "clear"}`, rows, interaction).toJSON(),
    ],
    content: role
      ? "Choose a subscription to tag with this role:"
      : "Choose a subscription to remove its role tag:",
  });
};

export const onRoleTag = async (
  ctx: FeatureContext,
  interaction: unknown
): Promise<boolean> => {
  const candidate = interaction as Partial<StringSelectMenuInteraction> | null;
  if (
    !candidate?.isStringSelectMenu?.() ||
    !/^jobs:role:(?:clear|[1-9]\d{16,19})$/u.test(candidate.customId ?? "")
  ) {
    return false;
  }
  const inter = candidate as StringSelectMenuInteraction;
  if (!(await requireManageGuild(inter))) {
    return true;
  }
  await inter.deferUpdate();
  try {
    if (!inter.guildId) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "Role tags are only available for server subscriptions."
      );
    }
    const value = inter.values[0] ?? "";
    if (
      inter.values.length !== 1 ||
      !/^[1-9]\d*$/u.test(value) ||
      !Number.isSafeInteger(Number(value))
    ) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "Pick a subscription from the menu."
      );
    }
    const actor = jobActor(inter);
    const rows = await ctx.jobListings.subscriptions.list(
      actor,
      jobScope(inter)
    );
    if (!rows.some((sub) => sub.id === Number(value))) {
      throw new JobSubscriptionError(
        "NOT_FOUND",
        "Subscription not found here."
      );
    }
    const role = inter.customId.slice("jobs:role:".length);
    await ctx.jobListings.subscriptions.update(actor, Number(value), {
      roleId: role === "clear" ? null : role,
    });
    await inter.editReply({
      components: [],
      content:
        role === "clear"
          ? "Role tag removed."
          : "Role tag saved. It will be mentioned once per job notification.",
      embeds: [],
    });
  } catch (error) {
    await inter.editReply({
      components: [],
      embeds: [errorEmbed(applicationErrorMessage(error))],
    });
  }
  return true;
};
