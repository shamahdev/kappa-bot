import { API_V1, ROUTES } from "@kappa/contracts";
import type { SubscriptionDtoType } from "@kappa/contracts";
import { Elysia, t } from "elysia";

import { sessionUser } from "../core/auth";
import { err, unauthorized } from "../core/errors";
import { createHttpJobAccess, jobRouteFailure } from "../core/job-access";
import { ensureDmChannel } from "../discord/api";
import { createPostingEvaluation } from "../modules/job-listings/application/posting-evaluation";
import { createJobSubscriptions } from "../modules/job-listings/application/subscriptions";
import {
  dmUserIdForScope,
  subscriptionKeywords,
  subscriptionSource,
  subscriptionPatch,
  assertScopeAccess,
  JobSubscriptionError,
  assertSubscriptionRole,
  scopeKey,
} from "../modules/job-listings/domain/subscription";
import type { JobSubscription } from "../modules/job-listings/domain/subscription";
import type { RouteDeps } from "./deps";

const toDto = (row: JobSubscription): SubscriptionDtoType => ({
  channelId: row.channelId,
  createdAt: row.createdAt.toISOString(),
  guildId: row.guildId,
  id: row.id,
  includeUnspecifiedEnvironment: row.includeUnspecifiedEnvironment ?? false,
  includeUnspecifiedSalary: row.includeUnspecifiedSalary ?? false,
  isActive: row.isActive,
  keywordAlternatives: row.keywordAlternatives ?? null,
  keywords: row.keywords,
  location: row.location,
  minimumSalary: row.minimumSalary ?? null,
  retentionDays: row.retentionDays,
  roleId: row.roleId ?? null,
  scope: dmUserIdForScope(row.guildId) === null ? "guild" : "dm",
  source: row.source,
  title: row.title ?? null,
  workEnvironments: row.workEnvironments ?? [],
});

const summarize = (row: JobSubscription): string =>
  `\`${row.source}\` ${row.keywords ?? "—"} · ${row.location ?? "—"} → <#${row.channelId}>`;

export const subscriptionRoutes = (deps: RouteDeps) => {
  const { config, db, log } = deps;
  const subscriptions = createJobSubscriptions(db);
  const evaluation = createPostingEvaluation(db, log, subscriptions.get);
  const optionFields = {
    includeUnspecifiedEnvironment: t.Optional(t.Boolean()),
    includeUnspecifiedSalary: t.Optional(t.Boolean()),
    minimumSalary: t.Optional(t.Union([t.Number(), t.Null()])),
    roleId: t.Optional(t.Union([t.String(), t.Null()])),
    title: t.Optional(t.Union([t.String(), t.Null()])),
    workEnvironments: t.Optional(
      t.Array(
        t.Union([t.Literal("onsite"), t.Literal("remote"), t.Literal("hybrid")])
      )
    ),
  };

  return new Elysia({ prefix: API_V1 })
    .get(
      ROUTES.subscriptions,
      async ({ request, query, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        const { actor } = createHttpJobAccess(deps, user.discordId);
        try {
          const rows = await subscriptions.list(
            actor,
            query.guild === undefined
              ? undefined
              : { guildId: query.guild, kind: "guild" }
          );
          const statuses = await evaluation.statuses(rows);
          return {
            subscriptions: rows.map((row) => ({
              ...toDto(row),
              evaluation: statuses.get(row.id) ?? {
                failed: 0,
                pending: 0,
                unavailable: null,
              },
            })),
          };
        } catch (error) {
          const failure = jobRouteFailure(error, deps, user.discordId);
          if (failure) {
            return status(failure.status, failure.body);
          }
          throw error;
        }
      },
      { query: t.Object({ guild: t.Optional(t.String()) }) }
    )
    .post(
      ROUTES.subscriptions,
      async ({ request, body, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        // Fail invalid input before creating a Discord destination.
        try {
          subscriptionSource(body.source);
          subscriptionKeywords(body.keywords);
          subscriptionPatch(body);
        } catch (error) {
          const failure = jobRouteFailure(error, deps, user.discordId);
          if (failure) {
            return status(failure.status, failure.body);
          }
          throw error;
        }
        const { actor } = createHttpJobAccess(deps, user.discordId);
        let channelId: string;
        try {
          const scope =
            body.guildId === undefined
              ? { kind: "personal" as const }
              : { guildId: body.guildId, kind: "guild" as const };
          await assertScopeAccess(actor, scope);
          await assertSubscriptionRole(
            actor,
            scopeKey(actor, scope),
            subscriptionPatch(body).roleId
          );
          if (body.guildId === undefined) {
            ({ id: channelId } = await ensureDmChannel(
              config.discordToken,
              user.discordId
            ));
          } else {
            await assertScopeAccess(actor, {
              guildId: body.guildId,
              kind: "guild",
            });
            if (!body.channelId?.trim()) {
              throw new JobSubscriptionError(
                "VALIDATION",
                "Pick a server text channel."
              );
            }
            const response = await fetch(
              `https://discord.com/api/v10/channels/${encodeURIComponent(body.channelId)}`,
              {
                headers: { Authorization: `Bot ${config.discordToken}` },
                signal: AbortSignal.timeout(15_000),
              }
            );
            if (!response.ok) {
              throw new JobSubscriptionError(
                "VALIDATION",
                "Server channel is unavailable to the bot."
              );
            }
            const channel = (await response.json()) as {
              guild_id?: string;
              type?: number;
            };
            if (channel.guild_id !== body.guildId || channel.type !== 0) {
              throw new JobSubscriptionError(
                "VALIDATION",
                "Pick a text channel in this server."
              );
            }
            ({ channelId } = body);
          }
        } catch (error) {
          const failure = jobRouteFailure(error, deps, user.discordId);
          if (failure) {
            return status(failure.status, failure.body);
          }
          log.warn(
            { error, userId: user.discordId },
            "dm channel ensure failed"
          );
          return status(
            502,
            err("OAUTH_FAILED", "discord request failed, try again later")
          );
        }
        try {
          const created = await subscriptions.create(actor, {
            ...body,
            channelId,
            keywords: body.keywords,
            scope:
              body.guildId === undefined
                ? { kind: "personal" }
                : { guildId: body.guildId, kind: "guild" },
            ...(body.guildId === undefined
              ? { scopeName: `DM with ${user.username}` }
              : {}),
            source: body.source,
          });
          return status(201, toDto(created));
        } catch (error) {
          const failure = jobRouteFailure(error, deps, user.discordId);
          if (failure) {
            return status(failure.status, failure.body);
          }
          throw error;
        }
      },
      {
        body: t.Object({
          ...optionFields,
          channelId: t.Optional(t.String()),
          guildId: t.Optional(t.String()),
          keywords: t.String(),
          location: t.Optional(t.String()),
          source: t.String(),
        }),
      }
    )
    .patch(
      ROUTES.subscriptionById,
      async ({ request, params, body, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        try {
          const { actor } = createHttpJobAccess(deps, user.discordId);
          return toDto(await subscriptions.update(actor, params.id, body));
        } catch (error) {
          const failure = jobRouteFailure(error, deps, user.discordId);
          if (failure) {
            return status(failure.status, failure.body);
          }
          throw error;
        }
      },
      {
        body: t.Object({
          ...optionFields,
          isActive: t.Optional(t.Boolean()),
          keywords: t.Optional(t.String()),
          location: t.Optional(t.String()),
          retentionDays: t.Optional(t.Number()),
        }),
        params: t.Object({ id: t.Numeric() }),
      }
    )
    .post(
      ROUTES.subscriptionRetry,
      async ({ request, params, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        try {
          const { actor } = createHttpJobAccess(deps, user.discordId);
          await evaluation.retry(actor, params.id);
          return toDto(await subscriptions.get(actor, params.id));
        } catch (error) {
          const failure = jobRouteFailure(error, deps, user.discordId);
          if (failure) {
            return status(failure.status, failure.body);
          }
          throw error;
        }
      },
      { params: t.Object({ id: t.Numeric() }) }
    )
    .delete(
      ROUTES.subscriptionById,
      async ({ request, params, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        try {
          const { actor } = createHttpJobAccess(deps, user.discordId);
          return {
            summary: summarize(await subscriptions.remove(actor, params.id)),
          };
        } catch (error) {
          const failure = jobRouteFailure(error, deps, user.discordId);
          if (failure) {
            return status(failure.status, failure.body);
          }
          throw error;
        }
      },
      { params: t.Object({ id: t.Numeric() }) }
    );
};
