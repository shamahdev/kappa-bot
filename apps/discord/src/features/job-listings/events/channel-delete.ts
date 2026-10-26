import type { FeatureContext } from "../../../core/feature";

/** Trusted Discord lifecycle event; application cleanup owns persistence. */
export const onChannelDelete = async (
  ctx: FeatureContext,
  ...args: unknown[]
): Promise<void> => {
  const channel = args[0] as { id?: string };
  if (!channel?.id) {
    return;
  }
  await ctx.jobListings.subscriptions.removeChannel(channel.id);
  ctx.log.info(
    { channelId: channel.id, feature: "job-listings" },
    "cleaned up deleted channel"
  );
};
