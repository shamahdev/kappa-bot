import { discordConnections } from "@kappa/db";
import type { Database } from "@kappa/db";
import { and, eq } from "drizzle-orm";

import {
  DiscordAuthError,
  fetchBotGuildIds,
  fetchUserGuilds,
  refreshAccessToken,
} from "../discord/api";
import type { DiscordGuildEntry } from "../discord/api";
import type { ServiceConfig } from "./config";

// Discord permission bits (as BigInt; the API returns the field stringified).
const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

/** True when the entry grants subscription management (owner/admin/manage). */
export const canManageGuild = (entry: DiscordGuildEntry): boolean => {
  if (entry.owner) {
    return true;
  }
  let perms: bigint;
  try {
    perms = BigInt(entry.permissions);
  } catch {
    return false;
  }
  // Discord permissions are a bitfield; both operators are required to test these flags.
  // oxlint-disable-next-line no-bitwise
  return (perms & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
};

/**
 * Usable user OAuth token, refreshing + persisting when expired (60s skew).
 * Returns null when the connection predates the `guilds` scope, the stored
 * grant lacks it, or the grant is dead (revoked/refresh rejected) — the
 * caller must answer 409 RECONNECT_REQUIRED. Discord transport/shape
 * failures throw (caller: 502).
 */
export const getUserAccessToken = async (
  db: Database,
  config: ServiceConfig,
  uid: string
): Promise<string | null> => {
  const [conn] = await db
    .select()
    .from(discordConnections)
    .where(
      and(
        eq(discordConnections.userId, uid),
        eq(discordConnections.provider, "discord")
      )
    );
  if (!(conn?.accessToken && conn.refreshToken)) {
    return null;
  }
  if (!conn.scopes.split(" ").includes("guilds")) {
    return null;
  }
  if (
    conn.tokenExpiresAt &&
    conn.tokenExpiresAt.getTime() - 60_000 > Date.now()
  ) {
    return conn.accessToken;
  }
  let tokens;
  try {
    tokens = await refreshAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: conn.refreshToken,
    });
  } catch {
    // Grant dead — re-login, not retry.
    return null;
  }
  await db
    .update(discordConnections)
    .set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
    })
    .where(eq(discordConnections.id, conn.id));
  return tokens.accessToken;
};

export interface ManageableGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
}

// Discord guild-list fan-out guard: one server-page load fires 3 API calls
// (guilds, subscriptions, jobs), each needing the user's guilds ∩ the bot's
// guilds. Without dedupe that's 6 Discord hits in one burst — enough to eat
// a 429 and 502 part of the page. So: singleflight collapses concurrent
// fetches per key, and a short TTL absorbs sequential navigations. Only
// successes are cached; auth/transport failures always re-hit Discord.
// Staleness window: membership changes land ≤30s (user) / ≤60s (bot) late.
const USER_GUILDS_TTL_MS = 30_000;
const BOT_GUILDS_TTL_MS = 60_000;
const USER_CACHE_MAX = 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const userGuildsCache = new Map<string, CacheEntry<DiscordGuildEntry[]>>();
let botGuildsCache: CacheEntry<Set<string>> | null = null;
const inflight = new Map<string, Promise<unknown>>();

const deduped = <T>(key: string, run: () => Promise<T>): Promise<T> => {
  const pending = inflight.get(key);
  if (pending) {
    return Promise.resolve(pending as Promise<T>);
  }
  try {
    const task = run().finally(() => {
      if (inflight.get(key) === task) {
        inflight.delete(key);
      }
    });
    inflight.set(key, task);
    return task;
  } catch (error) {
    return Promise.reject(error);
  }
};

const readUserGuildsCache = (uid: string): DiscordGuildEntry[] | null => {
  const entry = userGuildsCache.get(uid);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    userGuildsCache.delete(uid);
    return null;
  }
  return entry.value;
};

const writeUserGuildsCache = (
  uid: string,
  value: DiscordGuildEntry[]
): void => {
  if (userGuildsCache.size >= USER_CACHE_MAX) {
    userGuildsCache.delete(userGuildsCache.keys().next().value as string);
  }
  userGuildsCache.set(uid, {
    expiresAt: Date.now() + USER_GUILDS_TTL_MS,
    value,
  });
};

const cachedUserGuilds = async (
  uid: string,
  accessToken: string
): Promise<DiscordGuildEntry[]> => {
  const hit = readUserGuildsCache(uid);
  if (hit) {
    return hit;
  }
  const fresh = await deduped(`user-guilds:${uid}`, () =>
    fetchUserGuilds(accessToken)
  );
  writeUserGuildsCache(uid, fresh);
  return fresh;
};

const cachedBotGuildIds = async (botToken: string): Promise<Set<string>> => {
  if (botGuildsCache && botGuildsCache.expiresAt > Date.now()) {
    return botGuildsCache.value;
  }
  const fresh = await deduped("bot-guilds", () => fetchBotGuildIds(botToken));
  botGuildsCache = { expiresAt: Date.now() + BOT_GUILDS_TTL_MS, value: fresh };
  return fresh;
};

/**
 * Guilds the user can manage subscriptions in: user's guilds ∩ bot's guilds,
 * filtered to manage permission. Returns null when a re-login is required
 * (see getUserAccessToken, or Discord rejecting the user token with 401/403
 * — only the bot leg and genuine transport/shape failures throw, caller: 502).
 */
export const listManageableGuilds = async (
  db: Database,
  config: ServiceConfig,
  uid: string
): Promise<ManageableGuild[] | null> => {
  const accessToken = await getUserAccessToken(db, config, uid);
  if (!accessToken) {
    return null;
  }
  const [userSettled, botSettled] = await Promise.allSettled([
    cachedUserGuilds(uid, accessToken),
    cachedBotGuildIds(config.discordToken),
  ]);
  if (userSettled.status === "rejected") {
    if (userSettled.reason instanceof DiscordAuthError) {
      return null;
    }
    throw userSettled.reason;
  }
  if (botSettled.status === "rejected") {
    throw botSettled.reason;
  }
  const userGuilds = userSettled.value;
  const botGuilds = botSettled.value;
  return userGuilds
    .filter((g) => botGuilds.has(g.id) && canManageGuild(g))
    .map((g) => ({
      icon: g.icon,
      id: g.id,
      name: g.name,
      permissions: g.permissions,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
};
