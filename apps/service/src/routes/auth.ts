import { Elysia, redirect, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { discordConnections, sessions, users } from '@kappa/db';
import { readSessionToken, serializeSessionCookie, clearSessionCookie } from '../core/cookies';
import { hashToken, newSessionToken, sanitizeReturnTo, signState, verifyState } from '../core/crypto';
import { err } from '../core/errors';
import { resolveSession } from '../core/auth';
import { authorizeUrl, exchangeCode, fetchMe } from '../discord/api';
import type { RouteDeps } from './deps';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d (spec §5)

export function authRoutes(deps: RouteDeps) {
  const { config, db, log } = deps;
  const redirectUri = `${config.serviceUrl}${config.redirectPath}`;

  return new Elysia({ prefix: '/api/v1' })
    .get(
      '/auth/discord/login',
      ({ query }) => {
        const returnTo = sanitizeReturnTo(query.return_to);
        const state = signState(returnTo, config.sessionSecret);
        return redirect(
          authorizeUrl({ clientId: config.clientId, redirectUri, state }),
          302,
        );
      },
      { query: t.Object({ return_to: t.Optional(t.String()) }) },
    )
    .get(
      '/auth/discord/callback',
      async ({ query, request }) => {
        const fail = (reason: string) => {
          log.warn({ reason, ip: request.headers.get('x-forwarded-for') }, 'oauth callback failed');
          return redirect(`${config.webUrl}/auth/error`, 302);
        };
        const bound = query.state ? verifyState(query.state, config.sessionSecret) : null;
        if (!query.code || bound === null) return fail('missing code/state or bad state');
        const returnTo = sanitizeReturnTo(bound);
        let me: { id: string; username: string; avatar: string | null };
        try {
          const { accessToken } = await exchangeCode({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            code: query.code,
            redirectUri,
          });
          me = await fetchMe(accessToken);
        } catch (error) {
          log.warn({ error }, 'discord oauth upstream failure');
          return fail('oauth upstream failure');
        }
        const now = new Date();
        await db
          .insert(users)
          .values({ discordId: me.id, username: me.username, avatar: me.avatar })
          .onConflictDoUpdate({
            target: users.discordId,
            set: { username: me.username, avatar: me.avatar, updatedAt: now },
          });
        await db
          .insert(discordConnections)
          .values({ userId: me.id, provider: 'discord', scopes: 'identify' })
          .onConflictDoNothing();
        const token = newSessionToken();
        await db.insert(sessions).values({
          tokenHash: hashToken(token),
          userId: me.id,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        });
        log.info({ userId: me.id }, 'oauth login ok');
        return new Response(null, {
          status: 302,
          headers: {
            location: `${config.webUrl}${returnTo}`,
            'set-cookie': serializeSessionCookie(token, config.isProd),
          },
        });
      },
      { query: t.Object({ code: t.Optional(t.String()), state: t.Optional(t.String()) }) },
    )
    .post('/auth/logout', async ({ request, set }) => {
      const token = readSessionToken(request.headers.get('cookie'));
      if (token) {
        await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
      }
      set.headers['set-cookie'] = clearSessionCookie(config.isProd);
      return { ok: true };
    })
    .get('/auth/me', async ({ request, status }) => {
      const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
      if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
      return { user };
    });
}
