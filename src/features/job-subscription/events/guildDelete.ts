import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { guilds } from '../schema';

/** GuildDelete → drop the guild row; FK cascades clear channels/subs/seen. */
export async function onGuildDelete(ctx: FeatureContext, ...args: unknown[]): Promise<void> {
  const guild = args[0] as { id?: string };
  if (!guild?.id) return;
  await ctx.db.delete(guilds).where(eq(guilds.id, guild.id));
  ctx.log.info({ feature: 'job-subscription', guildId: guild.id }, 'cleaned up departed guild');
}
