import { botConfig, channels, guilds, subscriptions } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, desc, eq, or } from "drizzle-orm";

import {
  assertScopeAccess,
  assertSubscriptionAccess,
  dmScopeKey,
  JobSubscriptionError,
  nonBlankId,
  positiveSubscriptionId,
  scopeKey,
  subscriptionKeywords,
  subscriptionPatch,
  subscriptionRetentionDays,
  subscriptionSource,
} from "../domain/subscription";
import type {
  JobActor,
  JobScope,
  JobSubscription,
  JobSubscriptionPatch,
} from "../domain/subscription";

export interface CreateJobSubscription {
  scope: JobScope;
  channelId: string;
  scopeName?: string;
  source: string;
  keywords: string;
}

export const createJobSubscriptions = (db: Database) => {
  const get = async (actor: JobActor, id: number): Promise<JobSubscription> => {
    positiveSubscriptionId(id);
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id));
    if (!row) {
      throw new JobSubscriptionError("NOT_FOUND", "subscription not found");
    }
    await assertSubscriptionAccess(actor, row);
    return row;
  };

  return {
    async create(
      actor: JobActor,
      input: CreateJobSubscription
    ): Promise<JobSubscription> {
      // Normalize and validate the entire request before any writes.
      const guildId = scopeKey(actor, input.scope);
      const channelId = nonBlankId(input.channelId, "channel id");
      const source = subscriptionSource(input.source);
      const keywords = subscriptionKeywords(input.keywords);
      await assertScopeAccess(actor, input.scope);
      return db.transaction(async (tx) => {
        // Channel IDs cannot be rebound to a different personal/guild scope.
        const [existing] = await tx
          .select()
          .from(channels)
          .where(eq(channels.id, channelId));
        if (existing && existing.guildId !== guildId) {
          throw new JobSubscriptionError(
            "VALIDATION",
            "channel belongs to another scope"
          );
        }
        await tx
          .insert(guilds)
          .values({ id: guildId, name: input.scopeName })
          .onConflictDoNothing();
        await tx
          .insert(channels)
          .values({ guildId, id: channelId })
          .onConflictDoNothing();
        // Recheck after conflict handling, including concurrent channel creation.
        const [destination] = await tx
          .select()
          .from(channels)
          .where(eq(channels.id, channelId));
        if (destination?.guildId !== guildId) {
          throw new JobSubscriptionError(
            "VALIDATION",
            "channel belongs to another scope"
          );
        }
        const [row] = await tx
          .insert(subscriptions)
          .values({
            channelId,
            createdBy: actor.userId,
            distance: null,
            filters: {},
            guildId,
            keywords,
            location: "Indonesia",
            source,
          })
          .returning();
        return row;
      });
    },
    get,
    async list(
      actor: JobActor,
      scope?: JobScope,
      channelId?: string
    ): Promise<JobSubscription[]> {
      if (channelId !== undefined) {
        nonBlankId(channelId, "channel id");
      }
      const key = scope ? await assertScopeAccess(actor, scope) : null;
      const rows = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            key === null
              ? or(
                  eq(subscriptions.guildId, dmScopeKey(actor.userId)),
                  eq(subscriptions.createdBy, actor.userId)
                )
              : eq(subscriptions.guildId, key),
            channelId === undefined
              ? undefined
              : eq(subscriptions.channelId, channelId)
          )
        )
        .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id));
      if (scope) {
        return rows;
      }
      // A creator is only a candidate for listing, never an authorization grant.
      const grants = new Map<string, Promise<boolean>>();
      const cachedActor: JobActor = {
        canManageGuild(guildId) {
          let grant = grants.get(guildId);
          if (!grant) {
            grant = actor.canManageGuild(guildId);
            grants.set(guildId, grant);
          }
          return grant;
        },
        userId: actor.userId,
      };
      const allowed: JobSubscription[] = [];
      for (const row of rows) {
        try {
          // Finish each live access check before considering the next row, retaining grant caching and failure order.
          // oxlint-disable-next-line no-await-in-loop
          await assertSubscriptionAccess(cachedActor, row);
          allowed.push(row);
        } catch (error) {
          if (
            !(error instanceof JobSubscriptionError) ||
            error.code !== "FORBIDDEN"
          ) {
            throw error;
          }
        }
      }
      return allowed;
    },
    async pollIntervalMinutes(): Promise<number> {
      const [row] = await db
        .select()
        .from(botConfig)
        .where(eq(botConfig.id, 1));
      // Existing singleton/schema default.
      return row?.pollIntervalMinutes ?? 30;
    },
    async remove(actor: JobActor, id: number): Promise<JobSubscription> {
      const row = await get(actor, id);
      const [removed] = await db
        .delete(subscriptions)
        .where(eq(subscriptions.id, row.id))
        .returning();
      if (!removed) {
        throw new JobSubscriptionError("NOT_FOUND", "subscription not found");
      }
      return removed;
    },
    async removeChannel(channelId: string): Promise<void> {
      nonBlankId(channelId, "channel id");
      await db.delete(channels).where(eq(channels.id, channelId));
    },
    /** Trusted lifecycle entrypoints, not user-authorized management APIs. */
    async removeGuild(guildId: string): Promise<void> {
      nonBlankId(guildId, "guild id");
      await db.delete(guilds).where(eq(guilds.id, guildId));
    },
    async setRetention(
      actor: JobActor,
      scope: JobScope,
      retentionDays: number
    ): Promise<void> {
      const days = subscriptionRetentionDays(retentionDays);
      const key = await assertScopeAccess(actor, scope);
      await db
        .update(subscriptions)
        .set({ retentionDays: days })
        .where(eq(subscriptions.guildId, key));
    },
    async update(
      actor: JobActor,
      id: number,
      patch: JobSubscriptionPatch
    ): Promise<JobSubscription> {
      positiveSubscriptionId(id);
      const row = await get(actor, id);
      const valid = subscriptionPatch(patch);
      if (Object.keys(valid).length === 0) {
        return row;
      }
      const [updated] = await db
        .update(subscriptions)
        .set({
          ...valid,
          ...(valid.location !== undefined && valid.location !== row.location
            ? { geoId: null }
            : {}),
        })
        .where(eq(subscriptions.id, id))
        .returning();
      if (!updated) {
        throw new JobSubscriptionError("NOT_FOUND", "subscription not found");
      }
      return updated;
    },
  };
};
