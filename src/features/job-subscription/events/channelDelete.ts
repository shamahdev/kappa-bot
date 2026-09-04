import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { channels } from '../schema';

/** ChannelDelete → drop the channel row; FK cascades clear its subs/seen. */
export async function onChannelDelete(ctx: FeatureContext, ...args: unknown[]): Promise<void> {
  const channel = args[0] as { id?: string };
  if (!channel?.id) return;
  await ctx.db.delete(channels).where(eq(channels.id, channel.id));
  ctx.log.info({ feature: 'job-subscription', channelId: channel.id }, 'cleaned up deleted channel');
}
