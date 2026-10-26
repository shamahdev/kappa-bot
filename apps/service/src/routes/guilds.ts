import { Elysia } from "elysia";

import { resolveSession } from "../core/auth";
import { readSessionToken } from "../core/cookies";
import { err } from "../core/errors";
import { createJobQueries } from "../modules/job-listings/application/queries";
import type { RouteDeps } from "./deps";
import { createHttpJobAccess, jobRouteFailure } from "./subscriptions";

export const guildRoutes = (deps: RouteDeps) => {
  const { db } = deps;
  const jobs = createJobQueries(db);

  return new Elysia({ prefix: "/api/v1" }).get(
    "/guilds",
    async ({ request, status }) => {
      const user = await resolveSession(
        db,
        readSessionToken(request.headers.get("cookie"))
      );
      if (!user) {
        return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
      }
      try {
        const access = createHttpJobAccess(deps, user.discordId);
        const guilds = await access.manageableGuilds();
        const counts = await jobs.guildCounts(
          access.actor,
          guilds.map((guild) => guild.id)
        );
        return {
          guilds: guilds.map((guild) => ({
            ...guild,
            subscriptions: counts.get(guild.id) ?? { active: 0, total: 0 },
          })),
        };
      } catch (error) {
        const failure = jobRouteFailure(error, deps, user.discordId);
        if (failure) {
          return status(failure.status, failure.body);
        }
        throw error;
      }
    }
  );
};
