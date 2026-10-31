import { CV_MAX_UPLOAD_BYTES } from "@kappa/service/job-listings";
import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { errorEmbed, isDMInteraction } from "./_shared";

/** CV matching is personal-only: guild callers are sent to the bot DM. */
const requireDM = async (
  interaction: ChatInputCommandInteraction
): Promise<boolean> => {
  if (isDMInteraction(interaction)) {
    return true;
  }
  await interaction.reply({
    embeds: [
      errorEmbed("CV matching is personal-only — DM the bot to use it."),
    ],
    ephemeral: true,
  });
  return false;
};

const uploadSizeError = (bytes: number): string =>
  `That file is too big (${Math.round(bytes / 1024)}KB) — max ${CV_MAX_UPLOAD_BYTES / 1024 / 1024}MB.`;

export const executeCvUpload = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireDM(interaction))) {
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const file = interaction.options.getAttachment("file", true);
  if (file.size > CV_MAX_UPLOAD_BYTES) {
    await interaction.editReply({
      embeds: [errorEmbed(uploadSizeError(file.size))],
    });
    return;
  }
  let bytes: Uint8Array;
  try {
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`CDN ${response.status}`);
    }
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    await interaction.editReply({
      embeds: [
        errorEmbed("Couldn't download that file — try re-uploading it."),
      ],
    });
    return;
  }
  // Attachment metadata is not trusted: validate the bytes actually received as well.
  if (bytes.byteLength > CV_MAX_UPLOAD_BYTES) {
    await interaction.editReply({
      embeds: [errorEmbed(uploadSizeError(bytes.byteLength))],
    });
    return;
  }
  // All format validation and extraction occur in the shared application.
  const saved = await ctx.jobListings.cv.saveFile(
    interaction.user.id,
    bytes,
    file.name
  );
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f_6b_55)
        .setTitle("CV saved")
        .setDescription(
          [
            `File: ${saved.filename ?? file.name}`,
            `Uploaded: ${saved.updatedAt.toISOString().slice(0, 10)}`,
            "Your personal job cards can now show an A–E match grade with a factor breakdown.",
          ].join("\n")
        ),
    ],
  });
};

export const executeCvStatus = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireDM(interaction))) {
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const cv = await ctx.jobListings.cv.get(interaction.user.id);
  if (!cv) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3f_6b_55)
          .setTitle("No CV yet")
          .setDescription(
            "Upload one with `/jobs cv_upload` (`.pdf`/`.txt`/`.md`) to get A–E match grades on your personal job cards."
          ),
      ],
    });
    return;
  }
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f_6b_55)
        .setTitle("Your CV")
        .setDescription(
          [
            `File: ${cv.filename ?? "Uploaded CV"}`,
            `Uploaded: ${cv.updatedAt.toISOString().slice(0, 10)}`,
            "Replace it anytime with `/jobs cv_upload`, or remove it with `/jobs cv_remove`.",
          ].join("\n")
        ),
    ],
  });
};

export const executeCvRemove = async (
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext
): Promise<void> => {
  if (!(await requireDM(interaction))) {
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const removed = await ctx.jobListings.cv.remove(interaction.user.id);
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f_6b_55)
        .setDescription(
          removed
            ? "Your CV was removed — DM job cards will no longer show match scores."
            : "You have no CV saved."
        ),
    ],
  });
};
