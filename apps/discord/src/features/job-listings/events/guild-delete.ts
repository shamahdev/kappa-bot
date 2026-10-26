import type { FeatureContext } from "../../../core/feature";

/** Trusted Discord lifecycle event; application cleanup owns persistence. */
export const onGuildDelete = async (
  ctx: FeatureContext,
  ...args: unknown[]
): Promise<void> => {
  const guild = args[0] as { id?: string };
  if (!guild?.id) {
    return;
  }
  await ctx.jobListings.subscriptions.removeGuild(guild.id);
  ctx.log.info(
    { feature: "job-listings", guildId: guild.id },
    "cleaned up departed guild"
  );
};
