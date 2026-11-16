import {
  API_V1,
  ROUTES,
  MAX_API_PAGE_SIZE,
  DEFAULT_CV_REPORT_PAGE_SIZE,
  positiveIntegerParam,
} from "@kappa/contracts";
import { Elysia, t } from "elysia";

import { sessionUser } from "../core/auth";
import { err, unauthorized } from "../core/errors";
import { createCvProfiles } from "../modules/job-listings/application/cv";
import { createCvReportQueries } from "../modules/job-listings/application/cv-report-queries";
import { createCvReports } from "../modules/job-listings/application/cv-reports";
import { createJobEnrichment } from "../modules/job-listings/application/enrichment";
import type { RouteDeps } from "./deps";

export const cvReportRoutes = ({ db, lock, log }: RouteDeps) => {
  const queries = createCvReportQueries(db);
  const profiles = createCvProfiles(db);
  // No notifier here: the bot's polling tick sends the DM once a report is ready.
  const reports = createCvReports({
    db,
    enrichment: createJobEnrichment({ db, log }),
    lock,
    log,
  });
  const generateInBackground = async (id: number) => {
    try {
      await reports.generate(id);
    } catch (error) {
      log.warn({ error, reportId: id }, "manual CV report failed");
    }
  };
  return new Elysia({ prefix: API_V1 })
    .get(
      ROUTES.cvReports,
      async ({ request, query, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        const page = positiveIntegerParam(query.page, 1);
        const pageSize = positiveIntegerParam(
          query.pageSize,
          DEFAULT_CV_REPORT_PAGE_SIZE
        );
        if (!page || !pageSize || pageSize > MAX_API_PAGE_SIZE) {
          return status(
            400,
            err("VALIDATION", "page and pageSize must be positive integers")
          );
        }
        return await queries.list(user.discordId, page, pageSize);
      },
      {
        query: t.Object({
          page: t.Optional(t.String()),
          pageSize: t.Optional(t.String()),
        }),
      }
    )
    .post(ROUTES.cvReports, async ({ request, status }) => {
      const user = await sessionUser(db, request);
      if (!user) {
        return status(401, unauthorized());
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
    .post(
      ROUTES.cvReportRetry,
      async ({ request, params, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        const id = Number(params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
          return status(404, err("NOT_FOUND", "report not found"));
        }
        const result = await reports.retry(user.discordId, id);
        if (result === "not_found") {
          return status(404, err("NOT_FOUND", "report not found"));
        }
        if (result === "cv_required") {
          return status(
            400,
            err("VALIDATION", "Upload a CV before retrying this report.")
          );
        }
        if (result === "not_retryable") {
          return status(409, err("CONFLICT", "This report cannot be retried."));
        }
        void generateInBackground(id);
        return status(202, await queries.get(user.discordId, id));
      },
      { params: t.Object({ id: t.String() }) }
    )
    .get(
      ROUTES.cvReportById,
      async ({ request, params, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
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
