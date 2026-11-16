import { API_V1, ROUTES } from "@kappa/contracts";
import type { SubscriptionDtoType } from "@kappa/contracts";
import { Elysia, t } from "elysia";

import { sessionUser } from "../core/auth";
import { err, unauthorized } from "../core/errors";
import { createHttpJobAccess, jobRouteFailure } from "../core/job-access";
import { ensureDmChannel } from "../discord/api";
import { createJobSubscriptions } from "../modules/job-listings/application/subscriptions";
import {
  dmUserIdForScope,
  subscriptionKeywords,
  subscriptionSource,
} from "../modules/job-listings/domain/subscription";
import type { JobSubscription } from "../modules/job-listings/domain/subscription";
import type { RouteDeps } from "./deps";

const toDto = (row: JobSubscription): SubscriptionDtoType => ({
  channelId: row.channelId,
  createdAt: row.createdAt.toISOString(),
  guildId: row.guildId,
  id: row.id,
  isActive: row.isActive,
  keywords: row.keywords,
  location: row.location,
  retentionDays: row.retentionDays,
  scope: dmUserIdForScope(row.guildId) === null ? "guild" : "dm",
  source: row.source,
});

const summarize = (row: JobSubscription): string =>
  `\`${row.source}\` ${row.keywords ?? "—"} · ${row.location ?? "—"} → <#${row.channelId}>`;

export const subscriptionRoutes = (deps: RouteDeps) => {
  const { config, db, log } = deps;
  const subscriptions = createJobSubscriptions(db);

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
          return { subscriptions: rows.map(toDto) };
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
        } catch (error) {
          const failure = jobRouteFailure(error, deps, user.discordId);
          if (failure) {
            return status(failure.status, failure.body);
          }
          throw error;
        }
        let channelId: string;
        try {
          ({ id: channelId } = await ensureDmChannel(
            config.discordToken,
            user.discordId
          ));
        } catch (error) {
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
          const { actor } = createHttpJobAccess(deps, user.discordId);
          const created = await subscriptions.create(actor, {
            channelId,
            keywords: body.keywords,
            scope: { kind: "personal" },
            scopeName: `DM with ${user.username}`,
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
      { body: t.Object({ keywords: t.String(), source: t.String() }) }
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
          isActive: t.Optional(t.Boolean()),
          keywords: t.Optional(t.String()),
          location: t.Optional(t.String()),
          retentionDays: t.Optional(t.Number()),
        }),
        params: t.Object({ id: t.Numeric() }),
      }
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
