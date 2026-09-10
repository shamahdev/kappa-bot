// StringSelectMenu router for the subscription pickers (unsubscribe / fetch /
// show-latest). Wired as a feature `interactionCreate` event — the central
// router only handles slash commands, so there is no double-handling.
import { and, eq } from 'drizzle-orm';
import type { StringSelectMenuInteraction } from 'discord.js';
import type { FeatureContext } from '../../../core/feature';
import { subscriptions } from '../schema';
import { errorEmbed, scopeGuildId } from '../commands/_shared';
import { requireManageGuildComponent } from '../commands/_pick';
import { fetchResultEmbed, runFetch } from '../commands/fetch';
import { showLatestJob } from '../commands/latest';
import { removedEmbed, removeSubscription } from '../commands/unsubscribe';

function asSelectMenu(interaction: unknown): StringSelectMenuInteraction | null {
  if (typeof interaction !== 'object' || interaction === null) return null;
  const candidate = interaction as Partial<StringSelectMenuInteraction>;
  if (typeof candidate.isStringSelectMenu !== 'function') return null;
  return candidate.isStringSelectMenu() ? (candidate as StringSelectMenuInteraction) : null;
}

export async function onComponent(ctx: FeatureContext, interaction: unknown): Promise<void> {
  const inter = asSelectMenu(interaction);
  if (!inter) return;
  const [ns, action] = (inter.customId ?? '').split(':');
  if (ns !== 'jobs' || (action !== 'unsub' && action !== 'fetch' && action !== 'latest')) return;
  if (!(await requireManageGuildComponent(inter))) return;
  // Guild menus scope to the guild; DM menus scope to the caller's synthetic
  // per-user guild, so users can only touch their own DM subscriptions.
  const scope = scopeGuildId(inter);
  await inter.deferUpdate();

  const fail = async (message: string) => {
    await inter.editReply({ content: null, embeds: [errorEmbed(message)], components: [] });
  };

  if (action === 'unsub') {
    const id = Number(inter.values[0]);
    if (!Number.isInteger(id)) return fail('pick a subscription from the menu');
    const { ok, summary } = await removeSubscription(ctx, scope, id);
    if (!ok) return fail(summary);
    await inter.editReply({ content: null, embeds: [removedEmbed(summary)], components: [] });
    return;
  }

  // fetch + latest: single sub or (fetch only) 'all', scoped to this scope.
  const value = inter.values[0] ?? '';
  let where = and(
    eq(subscriptions.guildId, scope),
    eq(subscriptions.id, Number(value)),
    eq(subscriptions.isActive, true),
  );
  if (value === 'all' && action === 'fetch') {
    if (!inter.channelId) return fail('Run this from a channel.');
    where = and(
      eq(subscriptions.guildId, scope),
      eq(subscriptions.channelId, inter.channelId),
      eq(subscriptions.isActive, true),
    );
  }
  const rows = await ctx.db.select().from(subscriptions).where(where);
  if (rows.length === 0) {
    return fail('No matching active subscription. It may have been removed.');
  }

  try {
    if (action === 'fetch') {
      const result = await runFetch(ctx, rows);
      await inter.editReply({ content: null, embeds: [fetchResultEmbed(result)], components: [] });
    } else {
      const found = await showLatestJob(ctx, rows[0]!);
      if (!found) return fail('No JobPostings found for that subscription right now.');
      await inter.editReply({ content: null, embeds: found.embeds, components: [] });
    }
  } catch (err) {
    ctx.log.error({ err, guildId: scope }, 'component job fetch failed');
    return fail('Failed to fetch jobs due to an internal error.');
  }
}
