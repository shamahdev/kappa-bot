import { Elysia } from 'elysia';
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
    return { guilds };
  });
}
