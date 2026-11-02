import { Elysia, t } from "elysia";

import { resolveSession } from "../core/auth";
import { readSessionToken } from "../core/cookies";
import { err } from "../core/errors";
import { createCvProfiles } from "../modules/job-listings/application/cv";
import { createCvReportQueries } from "../modules/job-listings/application/cv-report-queries";
import { createCvReports } from "../modules/job-listings/application/cv-reports";
import { createJobEnrichment } from "../modules/job-listings/application/enrichment";
import type { RouteDeps } from "./deps";

export const cvReportRoutes = ({ db, log }: RouteDeps) => {
  const queries = createCvReportQueries(db);
  const profiles = createCvProfiles(db);
  // No notifier here: the bot's polling tick sends the DM once a report is ready.
  const reports = createCvReports({
    db,
    enrichment: createJobEnrichment({ db, log }),
    log,
  });
  const generateInBackground = async (id: number) => {
    try {
      await reports.generate(id);
    } catch (error) {
      log.warn({ error, reportId: id }, "manual CV report failed");
    }
  };
  const sessionUser = (request: Request) =>
    resolveSession(db, readSessionToken(request.headers.get("cookie")));

  return new Elysia({ prefix: "/api/v1/cv/reports" })
    .get("/", async ({ request, status }) => {
      const user = await sessionUser(request);
      if (!user) {
        return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
      }
      return { reports: await queries.list(user.discordId) };
    })
    .post("/", async ({ request, status }) => {
      const user = await sessionUser(request);
      if (!user) {
        return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
      }
      if (!(await profiles.get(user.discordId))) {
        return status(
          400,
          err("VALIDATION", "Upload a CV before creating a report.")
        );
      }
      const result = await reports.create(user.discordId, "manual");
      if (result.kind !== "created") {
        return status(
          409,
          err(
            "CONFLICT",
            "No new jobs have been delivered since your last report."
          )
        );
      }
      // Generate in the background; the dashboard's "Check status" refetches it.
      void generateInBackground(result.id);
      const report = await queries.get(user.discordId, result.id);
      return status(201, report);
    })
    .get(
      "/:id",
      async ({ request, params, status }) => {
        const user = await sessionUser(request);
        if (!user) {
          return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
        }
        const id = Number(params.id);
        const report =
          Number.isSafeInteger(id) && id > 0
            ? await queries.get(user.discordId, id)
            : null;
        return report ?? status(404, err("NOT_FOUND", "report not found"));
      },
      { params: t.Object({ id: t.String() }) }
    );
};
