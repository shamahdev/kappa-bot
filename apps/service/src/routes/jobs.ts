import { matchGradeForScore } from "@kappa/contracts";
import { Elysia, t } from "elysia";

import { resolveSession } from "../core/auth";
import { readSessionToken } from "../core/cookies";
import { err } from "../core/errors";
import { createJobQueries } from "../modules/job-listings/application/queries";
import type { RouteDeps } from "./deps";
import { createHttpJobAccess, jobRouteFailure } from "./subscriptions";

export const jobRoutes = (deps: RouteDeps) => {
  const { db } = deps;
  const jobs = createJobQueries(db);

  return new Elysia({ prefix: "/api/v1" }).get(
    "/jobs",
    async ({ request, query, status }) => {
      const user = await resolveSession(
        db,
        readSessionToken(request.headers.get("cookie"))
      );
      if (!user) {
        return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
      }
      // HTTP scope syntax is translated here, never passed as an authorization grant.
      const wantDm = query.scope === "dm";
      const guildId = query.guild;
      if (
        (wantDm ? 1 : 0) + (guildId === undefined ? 0 : 1) !== 1 ||
        (query.scope !== undefined && !wantDm)
      ) {
        return status(
          400,
          err("VALIDATION", "pass exactly one of scope=dm or guild=<id>")
        );
      }
      try {
        const { actor } = createHttpJobAccess(deps, user.discordId);
        const result = await jobs.list(
          actor,
          guildId === undefined
            ? { kind: "personal" }
            : { guildId, kind: "guild" },
          query
        );
        return {
          jobs: result.rows.map(({ job, aiSummary }) => ({
            aiSummary,
            company: job.snapshot?.company ?? null,
            externalId: job.externalId,
            firstSeenAt: job.firstSeenAt.toISOString(),
            id: job.id,
            location: job.snapshot?.location ?? null,
            matchBreakdown: wantDm ? job.matchBreakdown : null,
            matchGrade:
              wantDm && job.matchScore !== null
                ? matchGradeForScore(job.matchScore)
                : null,
            matchReason: wantDm ? job.matchReason : null,
            matchScore: wantDm ? job.matchScore : null,
            source: job.source,
            subscriptionId: job.subscriptionId,
            title: job.snapshot?.title ?? null,
            url: job.url,
          })),
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        };
      } catch (error) {
        const failure = jobRouteFailure(error, deps, user.discordId);
        if (failure) {
          return status(failure.status, failure.body);
        }
        throw error;
      }
    },
    {
      query: t.Object({
        guild: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        q: t.Optional(t.String()),
        scope: t.Optional(t.String()),
        source: t.Optional(t.String()),
        subscription: t.Optional(t.String()),
      }),
    }
  );
};
