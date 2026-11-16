import { JobSubscriptionError } from "@kappa/service/job-listings";
import type {
  ChatInputCommandInteraction,
  GuildMember,
  StringSelectMenuInteraction,
} from "discord.js";
import { EmbedBuilder } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import {
  applicationErrorMessage,
  errorEmbed,
  jobActor,
  jobScope,
  requireManageGuild,
} from "../interactions";
import { pickerRow } from "../picker";
import { EMBED_COLOR } from "../presentation";

const ASSIGN_PICKER_ID = "jobs:assign:pick";

export const executeNotifyRole = async (
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
      pickerRow(
        `jobs:notify:${role?.id ?? "clear"}`,
        rows,
        interaction
      ).toJSON(),
    ],
    content: role
      ? "Choose a subscription to tag with this role:"
      : "Choose a subscription to remove its role tag:",
  });
};

export const onNotifyRole = async (
  ctx: FeatureContext,
  interaction: unknown
): Promise<boolean> => {
  const candidate = interaction as Partial<StringSelectMenuInteraction> | null;
  if (
    !candidate?.isStringSelectMenu?.() ||
    !/^jobs:notify:(?:clear|[1-9]\d{16,19})$/u.test(candidate.customId ?? "")
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
    const role = inter.customId.slice("jobs:notify:".length);
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

const fetchGuildMember = async (
  inter: StringSelectMenuInteraction
): Promise<GuildMember> => {
  const member = inter.member as GuildMember | null;
  if (member?.roles?.add) {
    return member;
  }
  const fetched = await inter.guild?.members.fetch(inter.user.id);
  if (!fetched) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "Role assignment is only available in servers."
    );
  }
  return fetched;
};

/** Self-assignment shares the mentionable-role rule managers use to tag a role. */
const assignableNotifyRole = async (
  inter: StringSelectMenuInteraction,
  roleId: string
) => {
  if (!inter.guildId || !inter.guild) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "Role assignment is only available in servers."
    );
  }
  const role = await inter.guild.roles.fetch(roleId);
  // The same rules as assertSubscriptionRole: non-mentionable roles cannot be tagged.
  if (!role || role.id === inter.guildId || role.managed) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "That subscription's notification role is no longer assignable. A manager can set a new one with /jobs notify_role."
    );
  }
  return role;
};

export const executeAssignNotify = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!interaction.guildId) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "Role assignment is only available in servers."
    );
  }
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
    components: [pickerRow(ASSIGN_PICKER_ID, rows, interaction).toJSON()],
    content: "Choose a subscription to add its notification role to you:",
  });
};

export const onAssignNotify = async (
  ctx: FeatureContext,
  interaction: unknown
): Promise<boolean> => {
  const candidate = interaction as Partial<StringSelectMenuInteraction> | null;
  if (
    !candidate?.isStringSelectMenu?.() ||
    candidate.customId !== ASSIGN_PICKER_ID
  ) {
    return false;
  }
  const inter = candidate as StringSelectMenuInteraction;
  if (!(await requireManageGuild(inter))) {
    return true;
  }
  await inter.deferUpdate();
  try {
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
    const sub = rows.find((entry) => entry.id === Number(value));
    if (!sub) {
      throw new JobSubscriptionError(
        "NOT_FOUND",
        "Subscription not found here."
      );
    }
    if (!sub.roleId) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "That subscription has no notification role. A manager can set one with /jobs notify_role."
      );
    }
    const member = await fetchGuildMember(inter);
    const role = await assignableNotifyRole(inter, sub.roleId);
    if (member.roles.cache.has(role.id)) {
      await inter.editReply({
        components: [],
        content: `You already have the <@&${role.id}> role — job pings are on.`,
        embeds: [],
      });
      return true;
    }
    try {
      await member.roles.add(
        role,
        "Self-assigned a job subscription notification role"
      );
    } catch {
      throw new JobSubscriptionError(
        "VALIDATION",
        "I couldn't add that role — make sure I have the **Manage Roles** permission and that the role sits below mine."
      );
    }
    await inter.editReply({
      components: [],
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setDescription(
            `Added <@&${role.id}> — you'll be tagged by job notifications for that subscription.`
          ),
      ],
    });
  } catch (error) {
    await inter.editReply({
      components: [],
      embeds: [errorEmbed(applicationErrorMessage(error))],
    });
  }
  return true;
};
