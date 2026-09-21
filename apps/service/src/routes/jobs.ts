import { Elysia, t } from 'elysia';
import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { jobs as jobRows, seenJobs, subscriptions } from '@kappa/db';
import { SUBSCRIPTION_SOURCES } from '@kappa/contracts';
import { readSessionToken } from '../core/cookies';
import { err } from '../core/errors';
import { resolveSession } from '../core/auth';
import { listManageableGuilds } from '../core/guildAccess';
import type { RouteDeps } from './deps';

const CONCRETE_SOURCES = SUBSCRIPTION_SOURCES.filter((s) => s !== 'all');
const MAX_PAGE_SIZE = 100;

function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function jobRoutes(deps: RouteDeps) {
  const { config, db, log } = deps;

  return new Elysia({ prefix: '/api/v1' }).get(
    '/jobs',
    async ({ request, query, status }) => {
      const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
      if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
      const uid = user.discordId;

      // Scope: exactly one of scope=dm | guild=<id>. AuthZ mirrors subscriptions.
      const wantDm = query.scope === 'dm';
      const guildId = query.guild;
      if ((wantDm ? 1 : 0) + (guildId !== undefined ? 1 : 0) !== 1 || (query.scope !== undefined && !wantDm)) {
        return status(400, err('VALIDATION', 'pass exactly one of scope=dm or guild=<id>'));
      }
      let scopeGuildId: string;
      if (guildId !== undefined) {
        if (guildId.startsWith('dm:')) {
          return status(400, err('VALIDATION', 'guild filter must be a server id'));
        }
        let guilds;
        try {
          guilds = await listManageableGuilds(db, config, uid);
        } catch (error) {
          log.warn({ error, userId: uid }, 'jobs guild list discord failure');
          return status(502, err('OAUTH_FAILED', 'discord request failed, try again later'));
        }
        if (!guilds) {
          return status(409, err('RECONNECT_REQUIRED', 'reconnect Discord to manage servers'));
        }
        if (!guilds.some((g) => g.id === guildId)) {
          return status(404, err('NOT_FOUND', 'subscription not found'));
        }
        scopeGuildId = guildId;
      } else {
        scopeGuildId = `dm:${uid}`;
      }

      const page = parsePositiveInt(query.page, 1);
      const pageSize = parsePositiveInt(query.pageSize, 20);
      if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) {
        return status(400, err('VALIDATION', `page >= 1 and 1 <= pageSize <= ${MAX_PAGE_SIZE} required`));
      }
      if (query.source !== undefined && !(CONCRETE_SOURCES as readonly string[]).includes(query.source)) {
        return status(400, err('VALIDATION', `unknown source (one of ${CONCRETE_SOURCES.join('|')})`));
      }
      const subscriptionId = query.subscription === undefined ? null : parsePositiveInt(query.subscription, 0);
      if (query.subscription !== undefined && subscriptionId === null) {
        return status(400, err('VALIDATION', 'subscription filter must be a positive integer'));
      }
      if (subscriptionId !== null) {
        // The subscription filter must belong to the scope (else 404, same as row authz).
        const [row] = await db
          .select({ id: subscriptions.id })
          .from(subscriptions)
          .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.guildId, scopeGuildId)));
        if (!row) return status(404, err('NOT_FOUND', 'subscription not found'));
      }

      const filters: SQL[] = [eq(subscriptions.guildId, scopeGuildId)];
      if (subscriptionId !== null) filters.push(eq(seenJobs.subscriptionId, subscriptionId));
      if (query.source !== undefined) filters.push(eq(seenJobs.source, query.source));
      const q = query.q?.trim();
      if (q) {
        const pattern = `%${escapeLike(q)}%`;
        filters.push(
          sql`(${seenJobs.snapshot}->>'title' ILIKE ${pattern} OR ${seenJobs.snapshot}->>'company' ILIKE ${pattern})`,
        );
      }
      const where = and(...filters);

      const [totalRow] = await db
        .select({ total: count() })
        .from(seenJobs)
        .innerJoin(subscriptions, eq(seenJobs.subscriptionId, subscriptions.id))
        .where(where);
      const rows = await db
        .select({
          job: seenJobs,
          aiSummary: jobRows.aiSummary,
        })
        .from(seenJobs)
        .innerJoin(subscriptions, eq(seenJobs.subscriptionId, subscriptions.id))
        .leftJoin(jobRows, eq(seenJobs.jobId, jobRows.id))
        .where(where)
        .orderBy(desc(seenJobs.firstSeenAt), desc(seenJobs.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return {
        jobs: rows.map(({ job, aiSummary }) => ({
          id: job.id,
          subscriptionId: job.subscriptionId,
          source: job.source,
          externalId: job.externalId,
          url: job.url,
          title: job.snapshot?.title ?? null,
          company: job.snapshot?.company ?? null,
          location: job.snapshot?.location ?? null,
          firstSeenAt: job.firstSeenAt,
          matchScore: job.matchScore,
          matchReason: job.matchReason,
          aiSummary,
        })),
        page,
        pageSize,
        total: totalRow?.total ?? 0,
      };
    },
    {
      query: t.Object({
        scope: t.Optional(t.String()),
        guild: t.Optional(t.String()),
        subscription: t.Optional(t.String()),
        source: t.Optional(t.String()),
        q: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  );
}
