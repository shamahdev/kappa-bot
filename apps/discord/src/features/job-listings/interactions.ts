import type { JobActor, JobScope } from "@kappa/service/job-listings";
import { JobSubscriptionError } from "@kappa/service/job-listings";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";

import { ERROR_COLOR } from "./presentation";

export type JobInteraction =
  | ChatInputCommandInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;

export const isDMInteraction = (interaction: {
  guildId: string | null;
}): boolean =>
  interaction.guildId === null || interaction.guildId === undefined;

export const jobScope = (interaction: { guildId: string | null }): JobScope =>
  interaction.guildId
    ? { guildId: interaction.guildId, kind: "guild" }
    : { kind: "personal" };

/** Authenticated Discord identity and current permissions; never grant access just for being the creator. */
export const jobActor = (
  interaction: Pick<JobInteraction, "user" | "guildId" | "memberPermissions"> &
    Partial<Pick<JobInteraction, "guild">>
): JobActor => ({
  canManageGuild: (guildId) =>
    Promise.resolve(
      guildId === interaction.guildId &&
        (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
          false)
    ),
  canMentionRole: async (guildId, roleId) => {
    if (guildId !== interaction.guildId || !interaction.guild) {
      return false;
    }
    const role = await interaction.guild.roles.fetch(roleId);
    return Boolean(
      role && role.id !== guildId && role.mentionable && !role.managed
    );
  },
  userId: interaction.user.id,
});

export const errorEmbed = (message: string): EmbedBuilder =>
  new EmbedBuilder().setColor(ERROR_COLOR).setDescription(message);

/** Shared early UX gate. The application independently checks access on every operation. */
export const requireManageGuild = async (
  interaction: JobInteraction
): Promise<boolean> => {
  const { guildId } = interaction;
  if (
    guildId === null ||
    guildId === undefined ||
    (await jobActor(interaction).canManageGuild(guildId))
  ) {
    return true;
  }
  await interaction.reply({
    embeds: [
      errorEmbed(
        "You need the **Manage Server** permission to manage job subscriptions."
      ),
    ],
    ephemeral: true,
  });
  return false;
};

/** Only application errors expose their message; unexpected failures stay in the logs. */
export const applicationErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string => {
  if (error instanceof JobSubscriptionError) {
    return error.message;
  }
  return fallback;
};
