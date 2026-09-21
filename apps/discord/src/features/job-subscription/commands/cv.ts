import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { extractPdfText } from '@kappa/db';
import type { FeatureContext } from '../../../core/feature';
import { errorEmbed, isDMInteraction } from './_shared';
import {
  CV_MAX_UPLOAD_BYTES,
  cvFilenameError,
  cvTextError,
  deleteCv,
  loadCv,
  saveCv,
} from '../cv';

/** CV matching is personal-only: guild callers are sent to the bot DM. */
async function requireDM(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (isDMInteraction(interaction)) return true;
  await interaction.reply({
    embeds: [errorEmbed('CV matching is personal-only — DM the bot to use it.')],
    ephemeral: true,
  });
  return false;
}

export async function executeCvUpload(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireDM(interaction))) return;
  await interaction.deferReply({ ephemeral: true });
  const file = interaction.options.getAttachment('file', true);

  if (file.size > CV_MAX_UPLOAD_BYTES) {
    await interaction.editReply({
      embeds: [errorEmbed(`That file is too big (${Math.round(file.size / 1024)}KB) — max 2MB.`)],
    });
    return;
  }
  const nameError = cvFilenameError(file.name);
  if (nameError) {
    await interaction.editReply({ embeds: [errorEmbed(nameError)] });
    return;
  }
  const isPdf = file.name.toLowerCase().endsWith('.pdf');
  let text: string;
  try {
    const res = await fetch(file.url);
    if (!res.ok) throw new Error(`CDN ${res.status}`);
    const bytes = await res.arrayBuffer();
    text = isPdf
      ? await extractPdfText(new Uint8Array(bytes))
      : new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
  } catch (e) {
    // PDF extraction throws user-facing messages; text decode errors don't.
    const message =
      isPdf && e instanceof Error
        ? e.message
        : "Couldn't read that file — try re-uploading a plain `.txt` file.";
    await interaction.editReply({ embeds: [errorEmbed(message)] });
    return;
  }
  const textError = cvTextError(text);
  if (textError) {
    await interaction.editReply({ embeds: [errorEmbed(textError)] });
    return;
  }
  await saveCv(ctx.db, interaction.user.id, text, file.name);
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f6b55)
        .setTitle('✅ CV saved')
        .setDescription(
          [
            `File: \`${file.name}\` (${text.length} chars)`,
            'Your DM job cards will now show an AI match score.',
          ].join('\n'),
        ),
    ],
  });
}

export async function executeCvStatus(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireDM(interaction))) return;
  await interaction.deferReply({ ephemeral: true });
  const cv = await loadCv(ctx.db, interaction.user.id);
  if (!cv) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3f6b55)
          .setTitle('No CV yet')
          .setDescription('Upload one with `/jobs cv_upload` (`.pdf`/`.txt`/`.md`) to get AI match scores on your DM job cards.'),
      ],
    });
    return;
  }
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f6b55)
        .setTitle('Your CV')
        .setDescription(
          [
            `File: \`${cv.filename ?? 'pasted text'}\` (${cv.text.length} chars)`,
            `Updated: ${cv.updatedAt.toISOString().slice(0, 10)}`,
            'Replace it anytime with `/jobs cv_upload`, or remove it with `/jobs cv_remove`.',
          ].join('\n'),
        ),
    ],
  });
}

export async function executeCvRemove(
  interaction: ChatInputCommandInteraction,
  ctx: FeatureContext,
): Promise<void> {
  if (!(await requireDM(interaction))) return;
  await interaction.deferReply({ ephemeral: true });
  const removed = await deleteCv(ctx.db, interaction.user.id);
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3f6b55)
        .setDescription(
          removed ? 'Your CV was removed — DM job cards will no longer show match scores.' : 'You have no CV saved.',
        ),
    ],
  });
}
