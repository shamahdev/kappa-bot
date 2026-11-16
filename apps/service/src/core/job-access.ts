import type { Database } from "@kappa/db";

import { JobSubscriptionError } from "../modules/job-listings/domain/subscription";
import type { JobActor } from "../modules/job-listings/domain/subscription";
import type { ServiceConfig } from "./config";
import { err } from "./errors";
import { listManageableGuilds } from "./guild-access";
import type { Logger } from "./logger";

interface AccessDeps {
  db: Database;
  config: ServiceConfig;
  log: Logger;
}

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
export const createHttpJobAccess = (deps: AccessDeps, userId: string) => {
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
    canMentionRole: async (guildId, roleId) => {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/roles`,
        {
          headers: { Authorization: `Bot ${deps.config.discordToken}` },
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (!response.ok) {
        throw new HttpJobAccessError(
          "transport",
          new Error(`Discord role lookup HTTP ${response.status}`)
        );
      }
      const roles = (await response.json()) as {
        id: string;
        mentionable: boolean;
        managed: boolean;
      }[];
      return roles.some(
        (role) =>
          role.id === roleId &&
          role.id !== guildId &&
          role.mentionable &&
          !role.managed
      );
    },
    userId,
  };
  return { actor, manageableGuilds };
};

/** HTTP presentation masks forbidden rows and preserves OAuth error envelopes. */
export const jobRouteFailure = (
  error: unknown,
  deps: AccessDeps,
  userId: string
): { status: 400 | 404 | 409 | 502; body: ReturnType<typeof err> } | null => {
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
