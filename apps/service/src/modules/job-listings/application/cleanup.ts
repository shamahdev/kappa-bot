import {
  channels,
  cvProfiles,
  deliveryMessages,
  guilds,
  subscriptions,
} from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, eq, inArray, notLike } from "drizzle-orm";

import { dmScopeKey } from "../domain/subscription";

/**
 * Trusted cross-context cleanup. Accepts a transaction so the account coordinator
 * can atomically delete job data together with local auth/account data.
 * Guild subscriptions belong to the server, not their historical creator:
 * account deletion clears attribution without deleting server-owned data.
 */
export const removeJobListingAccountData = async (
  db: Pick<Database, "select" | "delete" | "update">,
  userId: string
): Promise<void> => {
  const key = dmScopeKey(userId);
  const dmChannels = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.guildId, key));
  await db.delete(subscriptions).where(eq(subscriptions.guildId, key));
  await db.delete(channels).where(eq(channels.guildId, key));
  await db.delete(guilds).where(eq(guilds.id, key));
  const ids = dmChannels.map((channel) => channel.id);
  if (ids.length > 0) {
    await db
      .delete(deliveryMessages)
      .where(inArray(deliveryMessages.channelId, ids));
  }
  await db
    .update(subscriptions)
    .set({ createdBy: null })
    .where(
      and(
        eq(subscriptions.createdBy, userId),
        notLike(subscriptions.guildId, "dm:%")
      )
    );
  await db.delete(cvProfiles).where(eq(cvProfiles.discordId, userId));
};
