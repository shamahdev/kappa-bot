import { Elysia, t } from "elysia";

import { resolveSession } from "../core/auth";
import { readSessionToken } from "../core/cookies";
import { err } from "../core/errors";
import { createCvReportQueries } from "../modules/job-listings/application/cv-report-queries";
import type { RouteDeps } from "./deps";

export const cvReportRoutes = ({ db }: RouteDeps) => {
  const reports = createCvReportQueries(db);
  return new Elysia({ prefix: "/api/v1/cv/reports" })
    .get("/", async ({ request, status }) => {
      const user = await resolveSession(
        db,
        readSessionToken(request.headers.get("cookie"))
      );
      if (!user) {
        return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
      }
      return { reports: await reports.list(user.discordId) };
    })
    .get(
      "/:id",
      async ({ request, params, status }) => {
        const user = await resolveSession(
          db,
          readSessionToken(request.headers.get("cookie"))
        );
        if (!user) {
          return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
        }
        const id = Number(params.id);
        const report =
          Number.isSafeInteger(id) && id > 0
            ? await reports.get(user.discordId, id)
            : null;
        return report ?? status(404, err("NOT_FOUND", "report not found"));
      },
      { params: t.Object({ id: t.String() }) }
    );
};
