import { and, eq } from 'drizzle-orm';
import { discordConnections, type GatewayDb } from '@kappa/db';
import type { ServiceConfig } from './config';
import {
  DiscordAuthError,
  fetchBotGuildIds,
  fetchUserGuilds,
  refreshAccessToken,
  type DiscordGuildEntry,
} from '../discord/api';

// Discord permission bits (as BigInt; the API returns the field stringified).
const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

/** True when the entry grants subscription management (owner/admin/manage). */
export function canManageGuild(entry: DiscordGuildEntry): boolean {
  if (entry.owner) return true;
  let perms: bigint;
  try {
    perms = BigInt(entry.permissions);
  } catch {
    return false;
  }
  return (perms & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
}

/**
 * Usable user OAuth token, refreshing + persisting when expired (60s skew).
 * Returns null when the connection predates the `guilds` scope, the stored
 * grant lacks it, or the grant is dead (revoked/refresh rejected) — the
 * caller must answer 409 RECONNECT_REQUIRED. Discord transport/shape
 * failures throw (caller: 502).
 */
export async function getUserAccessToken(
  db: GatewayDb,
  config: ServiceConfig,
  uid: string,
): Promise<string | null> {
  const [conn] = await db
    .select()
    .from(discordConnections)
    .where(
      and(eq(discordConnections.userId, uid), eq(discordConnections.provider, 'discord')),
    );
  if (!conn?.accessToken || !conn.refreshToken) return null;
  if (!conn.scopes.split(' ').includes('guilds')) return null;
  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - 60_000 > Date.now()) {
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
    return null; // grant dead — re-login, not retry
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
}

export type ManageableGuild = {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
};

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

type CacheEntry<T> = { value: T; expiresAt: number };

const userGuildsCache = new Map<string, CacheEntry<DiscordGuildEntry[]>>();
let botGuildsCache: CacheEntry<Set<string>> | null = null;
const inflight = new Map<string, Promise<unknown>>();

async function deduped<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const task = run().finally(() => {
    if (inflight.get(key) === task) inflight.delete(key);
  });
  inflight.set(key, task);
  return task;
}

function readUserGuildsCache(uid: string): DiscordGuildEntry[] | null {
  const entry = userGuildsCache.get(uid);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    userGuildsCache.delete(uid);
    return null;
  }
  return entry.value;
}

function writeUserGuildsCache(uid: string, value: DiscordGuildEntry[]): void {
  if (userGuildsCache.size >= USER_CACHE_MAX) {
    userGuildsCache.delete(userGuildsCache.keys().next().value as string);
  }
  userGuildsCache.set(uid, { value, expiresAt: Date.now() + USER_GUILDS_TTL_MS });
}

async function cachedUserGuilds(uid: string, accessToken: string): Promise<DiscordGuildEntry[]> {
  const hit = readUserGuildsCache(uid);
  if (hit) return hit;
  const fresh = await deduped(`user-guilds:${uid}`, () => fetchUserGuilds(accessToken));
  writeUserGuildsCache(uid, fresh);
  return fresh;
}

async function cachedBotGuildIds(botToken: string): Promise<Set<string>> {
  if (botGuildsCache && botGuildsCache.expiresAt > Date.now()) return botGuildsCache.value;
  const fresh = await deduped('bot-guilds', () => fetchBotGuildIds(botToken));
  botGuildsCache = { value: fresh, expiresAt: Date.now() + BOT_GUILDS_TTL_MS };
  return fresh;
}

/**
 * Guilds the user can manage subscriptions in: user's guilds ∩ bot's guilds,
 * filtered to manage permission. Returns null when a re-login is required
 * (see getUserAccessToken, or Discord rejecting the user token with 401/403
 * — only the bot leg and genuine transport/shape failures throw, caller: 502).
 */
export async function listManageableGuilds(
  db: GatewayDb,
  config: ServiceConfig,
  uid: string,
): Promise<ManageableGuild[] | null> {
  const accessToken = await getUserAccessToken(db, config, uid);
  if (!accessToken) return null;
  const [userSettled, botSettled] = await Promise.allSettled([
    cachedUserGuilds(uid, accessToken),
    cachedBotGuildIds(config.discordToken),
  ]);
  if (userSettled.status === 'rejected') {
    if (userSettled.reason instanceof DiscordAuthError) return null;
    throw userSettled.reason;
  }
  if (botSettled.status === 'rejected') throw botSettled.reason;
  const userGuilds = userSettled.value;
  const botGuilds = botSettled.value;
  return userGuilds
    .filter((g) => botGuilds.has(g.id) && canManageGuild(g))
    .map((g) => ({ id: g.id, name: g.name, icon: g.icon, permissions: g.permissions }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
