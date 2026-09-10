// Shared subscription picker (StringSelectMenu) helpers. Subscription ids stay
// in option VALUES only — users never see them; labels are human-readable.
import {
  ActionRowBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type Interaction,
} from 'discord.js';
import { and, eq, type SQL } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { subscriptions } from '../schema';
import { isDMInteraction } from './_shared';

export type Subscription = typeof subscriptions.$inferSelect;

function activeWhere(ctx: FeatureContext, where: SQL | undefined) {
  return ctx.db.select().from(subscriptions).where(where);
}

export async function activeChannelSubs(
  ctx: FeatureContext,
  guildId: string,
  channelId: string,
): Promise<Subscription[]> {
  return activeWhere(
    ctx,
    and(
      eq(subscriptions.guildId, guildId),
      eq(subscriptions.channelId, channelId),
      eq(subscriptions.isActive, true),
    ),
  );
}

export async function activeGuildSubs(ctx: FeatureContext, guildId: string): Promise<Subscription[]> {
  return activeWhere(ctx, and(eq(subscriptions.guildId, guildId), eq(subscriptions.isActive, true)));
}

/** Human label for a picker option — no id. Max 100 chars (Discord limit). */
export function subscriptionLabel(s: Subscription): string {
  return `${s.keywords ?? '—'} · ${s.source}${s.location ? ` · ${s.location}` : ''}`.slice(0, 100);
}

export function channelNameOf(interaction: Interaction, channelId: string): string | null {
  const guild = 'guild' in interaction ? interaction.guild : null;
  const name = guild?.channels.cache.get(channelId)?.name;
  return typeof name === 'string' ? name : null;
}

/** Select menu over Subscriptions (max 25 options). Prepends an "all" entry when asked. */
export function pickerRow(
  customId: string,
  subs: Subscription[],
  interaction: Interaction,
  allLabel?: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Choose a subscription');
  if (allLabel) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(allLabel)
        .setValue('all')
        .setDescription(`${subs.length} subscription(s)`)
        .setEmoji('⚡'),
    );
  }
  for (const s of subs.slice(0, allLabel ? 24 : 25)) {
    const channel = channelNameOf(interaction, s.channelId);
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(subscriptionLabel(s))
        .setValue(String(s.id))
        .setDescription((channel ? `Posts in #${channel}` : 'Subscription').slice(0, 100)),
    );
  }
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/** ManageGuild gate for component interactions (no command router there). */
export async function requireManageGuildComponent(interaction: Interaction): Promise<boolean> {
  // DMs have no member permissions: the DM owner acts only on their own
  // DM-scoped subscriptions (queries scope by dm guild below), so allow.
  if (isDMInteraction(interaction)) return true;
  const perms =
    'memberPermissions' in interaction ? interaction.memberPermissions : undefined;
  if (!perms?.has?.(PermissionFlagsBits.ManageGuild)) {
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: '❌ You need the **Manage Server** permission to manage job subscriptions.',
      });
    }
    return false;
  }
  return true;
}
