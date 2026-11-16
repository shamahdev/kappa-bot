import { API_V1, ROUTES } from "@kappa/contracts";
import { Elysia } from "elysia";

import { sessionUser } from "../core/auth";
import { unauthorized } from "../core/errors";
import { createHttpJobAccess, jobRouteFailure } from "../core/job-access";
import { createJobQueries } from "../modules/job-listings/application/queries";
import type { RouteDeps } from "./deps";

export const guildRoutes = (deps: RouteDeps) => {
  const { db } = deps;
  const jobs = createJobQueries(db);

  return new Elysia({ prefix: API_V1 }).get(
    ROUTES.guilds,
    async ({ request, status }) => {
      const user = await sessionUser(db, request);
      if (!user) {
        return status(401, unauthorized());
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
