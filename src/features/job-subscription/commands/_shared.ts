import {
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';

/** True for bot-DM / private-channel interactions (no guild scope). */
export function isDMInteraction(interaction: { guildId: string | null }): boolean {
  return interaction.guildId == null;
}

/** Belt-and-braces admin check (ticket 09 Q3 A): command default is ManageGuild. */
export async function requireManageGuild(interaction: ChatInputCommandInteraction): Promise<boolean> {
  // DMs have no guild membership: the DM owner manages only their own
  // DM-scoped subscriptions, so they are always authorized here.
  if (isDMInteraction(interaction)) return true;
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

/**
 * Scope key for subscription rows. Guild commands scope to the guild;
 * DM commands scope to a synthetic per-user guild (`dm:<userId>`) so the
 * existing guild-scoped schema/queries work unchanged — DM subscriptions
 * stay isolated per user and cascade-clean like guild rows.
 */
export function dmScopeGuildId(userId: string): string {
  return `dm:${userId}`;
}

export function scopeGuildId(interaction: {
  guildId: string | null;
  user: { id: string };
}): string {
  return interaction.guildId ?? dmScopeGuildId(interaction.user.id);
}
