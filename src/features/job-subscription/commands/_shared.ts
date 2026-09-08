import {
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';

// Research-01 filter vocabulary (guest search params).
export const ALLOWED_FILTER_KEYS = new Set([
  'f_TPR',
  'f_WT',
  'f_E',
  'f_JT',
  'f_SB2',
  'f_C',
  'f_AL',
  'f_EA',
  'f_VJ',
]);

export function parseFilters(raw: string | null): Record<string, string> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`filters is not valid JSON: ${raw}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('filters must be a JSON object, e.g. {"f_TPR":"r86400"}');
  }
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) {
      throw new Error(
        `unknown filter key "${key}" (allowed: ${Array.from(ALLOWED_FILTER_KEYS).join(', ')})`,
      );
    }
  }
  return parsed as Record<string, string>;
}

/** Belt-and-braces admin check (ticket 09 Q3 A): command default is ManageGuild. */
export async function requireManageGuild(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const member = interaction.member;
  const perms =
    member && typeof member === 'object' && 'permissions' in member
      ? (member.permissions as { has?: (flag: bigint) => boolean })
      : undefined;
  if (!perms?.has?.(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xe5484d).setDescription('❌ You need the **Manage Server** permission to manage job subscriptions.')],
    });
    return false;
  }
  return true;
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xe5484d).setDescription(`❌ ${message}`);
}
