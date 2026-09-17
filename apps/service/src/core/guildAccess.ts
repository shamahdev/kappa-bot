import { and, eq } from 'drizzle-orm';
import { discordConnections, type GatewayDb } from '@kappa/db';
import type { ServiceConfig } from './config';
import {
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
 * Returns null when the connection predates the `guilds` scope or the grant
 * is dead (revoked/refresh rejected) — the caller must answer 409
 * RECONNECT_REQUIRED. Discord transport/shape failures throw (caller: 502).
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

/**
 * Guilds the user can manage subscriptions in: user's guilds ∩ bot's guilds,
 * filtered to manage permission. Returns null when a re-login is required
 * (see getUserAccessToken). Discord failures throw (caller: 502).
 */
export async function listManageableGuilds(
  db: GatewayDb,
  config: ServiceConfig,
  uid: string,
): Promise<ManageableGuild[] | null> {
  const accessToken = await getUserAccessToken(db, config, uid);
  if (!accessToken) return null;
  const [userGuilds, botGuilds] = await Promise.all([
    fetchUserGuilds(accessToken),
    fetchBotGuildIds(config.discordToken),
  ]);
  return userGuilds
    .filter((g) => botGuilds.has(g.id) && canManageGuild(g))
    .map((g) => ({ id: g.id, name: g.name, icon: g.icon, permissions: g.permissions }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
