import type { SubscriptionDtoType } from "@kappa/contracts";
import { Elysia, t } from "elysia";

import { resolveSession } from "../core/auth";
import { readSessionToken } from "../core/cookies";
import { err } from "../core/errors";
import { listManageableGuilds } from "../core/guild-access";
import { ensureDmChannel } from "../discord/api";
import { createJobSubscriptions } from "../modules/job-listings/application/subscriptions";
import {
  dmUserIdForScope,
  JobSubscriptionError,
  subscriptionKeywords,
  subscriptionSource,
} from "../modules/job-listings/domain/subscription";
import type {
  JobActor,
  JobSubscription,
} from "../modules/job-listings/domain/subscription";
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

class HttpJobAccessError extends Error {
  readonly kind: "reconnect" | "transport";
  readonly cause?: unknown;

  constructor(kind: "reconnect" | "transport", cause?: unknown) {
    super(kind);
    this.name = "HttpJobAccessError";
    this.kind = kind;
    this.cause = cause;
  }
}

/** Trusted, request-local actor. No browser-provided grants or creator bypass. */
export const createHttpJobAccess = (deps: RouteDeps, userId: string) => {
  let pending: ReturnType<typeof listManageableGuilds> | undefined;
  const manageableGuilds = async () => {
    pending ??= listManageableGuilds(deps.db, deps.config, userId);
    let guilds;
    try {
      guilds = await pending;
    } catch (error) {
      throw new HttpJobAccessError("transport", error);
    }
    if (!guilds) {
      throw new HttpJobAccessError("reconnect");
    }
    return guilds;
  };
  const actor: JobActor = {
    canManageGuild: async (guildId) => {
      const guilds = await manageableGuilds();
      return guilds.some((guild) => guild.id === guildId);
    },
    userId,
  };
  return { actor, manageableGuilds };
};

/** Controller-only mapping: mask forbidden rows and preserve OAuth envelopes. */
export const jobRouteFailure = (
  error: unknown,
  deps: RouteDeps,
  userId: string
): {
  status: 400 | 404 | 409 | 502;
  body: ReturnType<typeof err>;
} | null => {
  if (error instanceof JobSubscriptionError) {
    return error.code === "VALIDATION"
      ? { body: err("VALIDATION", error.message), status: 400 }
      : { body: err("NOT_FOUND", "subscription not found"), status: 404 };
  }
  if (error instanceof HttpJobAccessError) {
    if (error.kind === "reconnect") {
      return {
        body: err("RECONNECT_REQUIRED", "reconnect Discord to manage servers"),
        status: 409,
      };
    }
    deps.log.warn({ error: error.cause, userId }, "job access discord failure");
    return {
      body: err("OAUTH_FAILED", "discord request failed, try again later"),
      status: 502,
    };
  }
  return null;
};

/** One-line sub summary for the delete-subscription Brief. */
const summarize = (row: JobSubscription): string =>
  `\`${row.source}\` ${row.keywords ?? "—"} · ${row.location ?? "—"} → <#${row.channelId}>`;

export const subscriptionRoutes = (deps: RouteDeps) => {
  const { config, db, log } = deps;
  const subscriptions = createJobSubscriptions(db);

  return new Elysia({ prefix: "/api/v1" })
    .get(
      "/subscriptions",
      async ({ request, query, status }) => {
        const user = await resolveSession(
          db,
          readSessionToken(request.headers.get("cookie"))
        );
        if (!user) {
          return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
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
      "/subscriptions",
      async ({ request, body, status }) => {
        const user = await resolveSession(
          db,
          readSessionToken(request.headers.get("cookie"))
        );
        if (!user) {
          return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
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
      "/subscriptions/:id",
      async ({ request, params, body, status }) => {
        const user = await resolveSession(
          db,
          readSessionToken(request.headers.get("cookie"))
        );
        if (!user) {
          return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
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
      "/subscriptions/:id",
      async ({ request, params, status }) => {
        const user = await resolveSession(
          db,
          readSessionToken(request.headers.get("cookie"))
        );
        if (!user) {
          return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
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
