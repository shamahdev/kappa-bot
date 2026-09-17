import { Elysia } from 'elysia';
import { and, count, eq, gt, inArray, ne } from 'drizzle-orm';
import {
  channels,
  deliveryMessages,
  discordConnections,
  guilds,
  sessions,
  subscriptions,
  users,
} from '@kappa/db';
import { clearSessionCookie, readSessionToken } from '../core/cookies';
import { err } from '../core/errors';
import { resolveSession } from '../core/auth';
import { revokeDiscordToken } from '../discord/api';
import type { RouteDeps } from './deps';

export function accountRoutes(deps: RouteDeps) {
  const { config, db, log } = deps;

  return new Elysia({ prefix: '/api/v1' })
    .get('/account/summary', async ({ request, status }) => {
      const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
      if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
      const uid = user.discordId;
      const dm = `dm:${uid}`;
      const [[dmCount], [guildCount], conns, [sessCount]] = await Promise.all([
        db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.guildId, dm)),
        db
          .select({ n: count() })
          .from(subscriptions)
          .where(and(eq(subscriptions.createdBy, uid), ne(subscriptions.guildId, dm))),
        db
          .select({ provider: discordConnections.provider })
          .from(discordConnections)
          .where(eq(discordConnections.userId, uid)),
        db
          .select({ n: count() })
          .from(sessions)
          .where(and(eq(sessions.userId, uid), gt(sessions.expiresAt, new Date()))),
      ]);
      return {
        discordId: uid,
        username: user.username,
        dmSubscriptions: dmCount.n,
        guildSubscriptionsCreated: guildCount.n,
        connections: conns.map((c) => c.provider),
        sessionsActive: sessCount.n,
      };
    })
    .delete('/account', async ({ request, set, status }) => {
      const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
      if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
      const uid = user.discordId;
      const dm = `dm:${uid}`;
      // EXACT cascade order (spec §5): sessions → discord_connections → DM
      // subs (cascade seen) → DM channels + guilds rows → delivery_messages
      // for the DM channel → guild subs createdBy me (cascade seen) → users.
      // The OAuth token is captured first for the best-effort revoke at the end.
      const [conn] = await db
        .select({ accessToken: discordConnections.accessToken })
        .from(discordConnections)
        .where(eq(discordConnections.userId, uid));
      await db.delete(sessions).where(eq(sessions.userId, uid));
      await db.delete(discordConnections).where(eq(discordConnections.userId, uid));
      const dmChannels = await db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.guildId, dm));
      await db.delete(subscriptions).where(eq(subscriptions.guildId, dm));
      await db.delete(channels).where(eq(channels.guildId, dm));
      await db.delete(guilds).where(eq(guilds.id, dm));
      const dmChannelIds = dmChannels.map((c) => c.id);
      if (dmChannelIds.length > 0) {
        await db.delete(deliveryMessages).where(inArray(deliveryMessages.channelId, dmChannelIds));
      }
      await db.delete(subscriptions).where(eq(subscriptions.createdBy, uid));
      await db.delete(users).where(eq(users.discordId, uid));
      try {
        await revokeDiscordToken({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          token: conn?.accessToken ?? null,
        });
      } catch (error) {
        log.warn({ error, userId: uid }, 'discord token revoke failed (best-effort)');
      }
      log.info({ userId: uid }, 'account deleted');
      set.headers['set-cookie'] = clearSessionCookie(config.isProd);
      return { ok: true };
    });
}
