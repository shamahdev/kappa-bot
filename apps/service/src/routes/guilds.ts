import { Elysia } from 'elysia';
import { inArray } from 'drizzle-orm';
import { subscriptions } from '@kappa/db';
import { readSessionToken } from '../core/cookies';
import { err } from '../core/errors';
import { resolveSession } from '../core/auth';
import { listManageableGuilds } from '../core/guildAccess';
import type { RouteDeps } from './deps';

export function guildRoutes(deps: RouteDeps) {
  const { config, db, log } = deps;

  return new Elysia({ prefix: '/api/v1' }).get('/guilds', async ({ request, status }) => {
    const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
    if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
    let guilds;
    try {
      guilds = await listManageableGuilds(db, config, user.discordId);
    } catch (error) {
      log.warn({ error, userId: user.discordId }, 'guild list discord failure');
      return status(502, err('OAUTH_FAILED', 'discord request failed, try again later'));
    }
    if (!guilds) {
      return status(409, err('RECONNECT_REQUIRED', 'reconnect Discord to manage servers'));
    }
    // Subscription counts per guild for the dashboard cards (aggregated in JS:
    // a user's manageable guilds and their subs are both small).
    const counts = new Map<string, { total: number; active: number }>();
    if (guilds.length > 0) {
      const rows = await db
        .select({ guildId: subscriptions.guildId, isActive: subscriptions.isActive })
        .from(subscriptions)
        .where(
          inArray(
            subscriptions.guildId,
            guilds.map((g) => g.id),
          ),
        );
      for (const row of rows) {
        const entry = counts.get(row.guildId) ?? { total: 0, active: 0 };
        entry.total += 1;
        if (row.isActive) entry.active += 1;
        counts.set(row.guildId, entry);
      }
    }
    return {
      guilds: guilds.map((g) => ({
        ...g,
        subscriptions: counts.get(g.id) ?? { total: 0, active: 0 },
      })),
    };
  });
}
