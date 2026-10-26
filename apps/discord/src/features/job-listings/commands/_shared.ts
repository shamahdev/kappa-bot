import type { JobActor, JobScope } from "@kappa/service/job-listings";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

export type JobInteraction =
  | ChatInputCommandInteraction
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
  interaction: Pick<JobInteraction, "user" | "guildId" | "memberPermissions">
): JobActor => ({
  canManageGuild: (guildId) =>
    Promise.resolve(
      guildId === interaction.guildId &&
        (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
          false)
    ),
  userId: interaction.user.id,
});

export const errorEmbed = (message: string): EmbedBuilder =>
  new EmbedBuilder().setColor(0xe5_48_4d).setDescription(message);

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
  if (
    error instanceof Error &&
    "code" in error &&
    (error.code === "FORBIDDEN" ||
      error.code === "NOT_FOUND" ||
      error.code === "VALIDATION")
  ) {
    return error.message;
  }
  return fallback;
};
