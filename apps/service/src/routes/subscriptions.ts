import { Elysia, t } from 'elysia';
import { and, desc, eq, or } from 'drizzle-orm';
import { channels, guilds, subscriptions } from '@kappa/db';
import { isSubscriptionSource, SUBSCRIPTION_SOURCES, type SubscriptionDtoType } from '@kappa/contracts';
import { readSessionToken } from '../core/cookies';
import { err } from '../core/errors';
import { resolveSession } from '../core/auth';
import { listManageableGuilds } from '../core/guildAccess';
import { ensureDmChannel } from '../discord/api';
import type { RouteDeps } from './deps';

type SubscriptionRow = typeof subscriptions.$inferSelect;

const dmScope = (uid: string): string => `dm:${uid}`;

function toDto(row: SubscriptionRow): SubscriptionDtoType {
  return {
    id: row.id,
    scope: row.guildId.startsWith('dm:') ? 'dm' : 'guild',
    guildId: row.guildId,
    channelId: row.channelId,
    source: row.source,
    keywords: row.keywords,
    location: row.location,
    isActive: row.isActive,
    retentionDays: row.retentionDays,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Row authz: `guildId == dm:<uid> OR createdBy == <uid>` wins without any
 * Discord call; other guild-scope rows require live ManageGuild proof.
 * Stale/absent grant → null (404); Discord transport failures throw (502).
 */
async function loadOwned(
  deps: RouteDeps,
  id: number,
  uid: string,
): Promise<SubscriptionRow | null> {
  const [row] = await deps.db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id));
  if (!row) return null;
  if (row.guildId === dmScope(uid) || row.createdBy === uid) return row;
  if (row.guildId.startsWith('dm:')) return null; // someone else's DMs, never
  const guilds = await listManageableGuilds(deps.db, deps.config, uid);
  return guilds?.some((g) => g.id === row.guildId) ? row : null;
}

/** One-line sub summary for the delete-subscription Brief (spec §7). */
function summarize(row: SubscriptionRow): string {
  return `\`${row.source}\` ${row.keywords ?? '—'} · ${row.location ?? '—'} → <#${row.channelId}>`;
}

export function subscriptionRoutes(deps: RouteDeps) {
  const { config, db, log } = deps;

  return new Elysia({ prefix: '/api/v1' })
    .get(
      '/subscriptions',
      async ({ request, query, status }) => {
        const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
        if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
        if (query.guild !== undefined) {
          if (query.guild.startsWith('dm:')) {
            return status(400, err('VALIDATION', 'guild filter must be a server id'));
          }
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
          if (!guilds.some((g) => g.id === query.guild)) {
            return status(404, err('NOT_FOUND', 'subscription not found'));
          }
          const rows = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.guildId, query.guild))
            .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id));
          return { subscriptions: rows.map(toDto) };
        }
        const rows = await db
          .select()
          .from(subscriptions)
          .where(
            or(
              eq(subscriptions.guildId, dmScope(user.discordId)),
              eq(subscriptions.createdBy, user.discordId),
            ),
          )
          .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id));
        return { subscriptions: rows.map(toDto) };
      },
      { query: t.Object({ guild: t.Optional(t.String()) }) },
    )
    .post(
      '/subscriptions',
      async ({ request, body, status }) => {
        const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
        if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
        if (!isSubscriptionSource(body.source)) {
          return status(
            400,
            err('VALIDATION', `unknown source "${body.source}" (supported: ${SUBSCRIPTION_SOURCES.join(', ')})`),
          );
        }
        const keywords = body.keywords.trim();
        if (!keywords) return status(400, err('VALIDATION', 'keywords must not be blank'));
        // DM scope only v1: ensure the bot↔user DM channel via Discord REST,
        // then upsert the synthetic dm:<uid> guild + channel rows.
        let channelId: string;
        try {
          ({ id: channelId } = await ensureDmChannel(config.discordToken, user.discordId));
        } catch (error) {
          log.warn({ error, userId: user.discordId }, 'dm channel ensure failed');
          return status(502, err('OAUTH_FAILED', 'discord request failed, try again later'));
        }
        const scope = dmScope(user.discordId);
        await db
          .insert(guilds)
          .values({ id: scope, name: `DM with ${user.username}` })
          .onConflictDoNothing();
        await db.insert(channels).values({ id: channelId, guildId: scope }).onConflictDoNothing();
        const [created] = await db
          .insert(subscriptions)
          .values({
            guildId: scope,
            channelId,
            keywords,
            location: 'Indonesia',
            distance: null,
            filters: {},
            source: body.source,
            createdBy: user.discordId,
          })
          .returning();
        return status(201, toDto(created));
      },
      { body: t.Object({ source: t.String(), keywords: t.String() }) },
    )
    .patch(
      '/subscriptions/:id',
      async ({ request, params, body, status }) => {
        const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
        if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
        if (!Number.isInteger(params.id) || params.id <= 0) {
          return status(400, err('VALIDATION', 'subscription id must be a positive integer'));
        }
        let row;
        try {
          row = await loadOwned(deps, params.id, user.discordId);
        } catch (error) {
          log.warn({ error, userId: user.discordId }, 'subscription authz discord failure');
          return status(502, err('OAUTH_FAILED', 'discord request failed, try again later'));
        }
        if (!row) return status(404, err('NOT_FOUND', 'subscription not found'));
        const patch: Partial<Pick<SubscriptionRow, 'keywords' | 'location' | 'isActive' | 'retentionDays'>> = {};
        if (body.keywords !== undefined) {
          if (!body.keywords.trim()) return status(400, err('VALIDATION', 'keywords must not be blank'));
          patch.keywords = body.keywords.trim();
        }
        if (body.location !== undefined) {
          if (!body.location.trim()) return status(400, err('VALIDATION', 'location must not be blank'));
          patch.location = body.location.trim();
        }
        if (body.isActive !== undefined) patch.isActive = body.isActive;
        if (body.retentionDays !== undefined) {
          if (!Number.isInteger(body.retentionDays) || body.retentionDays < 1 || body.retentionDays > 365) {
            return status(400, err('VALIDATION', 'retentionDays must be an integer 1–365'));
          }
          patch.retentionDays = body.retentionDays;
        }
        if (Object.keys(patch).length === 0) return toDto(row);
        const [updated] = await db
          .update(subscriptions)
          .set(patch)
          .where(eq(subscriptions.id, row.id))
          .returning();
        return toDto(updated);
      },
      {
        params: t.Object({ id: t.Numeric() }),
        body: t.Object({
          keywords: t.Optional(t.String()),
          location: t.Optional(t.String()),
          isActive: t.Optional(t.Boolean()),
          retentionDays: t.Optional(t.Number()),
        }),
      },
    )
    .delete(
      '/subscriptions/:id',
      async ({ request, params, status }) => {
        const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
        if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
        if (!Number.isInteger(params.id) || params.id <= 0) {
          return status(400, err('VALIDATION', 'subscription id must be a positive integer'));
        }
        let row;
        try {
          row = await loadOwned(deps, params.id, user.discordId);
        } catch (error) {
          log.warn({ error, userId: user.discordId }, 'subscription authz discord failure');
          return status(502, err('OAUTH_FAILED', 'discord request failed, try again later'));
        }
        if (!row) return status(404, err('NOT_FOUND', 'subscription not found'));
        const summary = summarize(row);
        await db.delete(subscriptions).where(eq(subscriptions.id, row.id)); // cascades seen_jobs
        return { summary };
      },
      { params: t.Object({ id: t.Numeric() }) },
    );
}
