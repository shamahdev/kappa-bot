import { APPLICATION_STATUSES, API_V1, ROUTES } from "@kappa/contracts";
import { Elysia, t } from "elysia";

import { sessionUser } from "../core/auth";
import { err, unauthorized } from "../core/errors";
import { createJobApplications } from "../modules/job-listings/application/applications";
import { JobSubscriptionError } from "../modules/job-listings/domain/subscription";
import type { RouteDeps } from "./deps";

const status = t.Union(APPLICATION_STATUSES.map((value) => t.Literal(value)));
const positiveId = (raw: string) => {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const applicationRoutes = ({ db }: RouteDeps) => {
  const applications = createJobApplications(db);
  const notFound = err("NOT_FOUND", "application not found");

  return new Elysia({ prefix: API_V1 })
    .get(ROUTES.applications, async ({ request, status: reply }) => {
      const user = await sessionUser(db, request);
      if (!user) {
        return reply(401, unauthorized());
      }
      return { applications: await applications.list(user.discordId) };
    })
    .post(
      ROUTES.applications,
      async ({ request, body, status: reply }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return reply(401, unauthorized());
        }
        try {
          return reply(
            201,
            await applications.track(
              user.discordId,
              body.seenJobId,
              body.status
            )
          );
        } catch (error) {
          if (
            error instanceof JobSubscriptionError &&
            error.code === "NOT_FOUND"
          ) {
            return reply(404, err("NOT_FOUND", error.message));
          }
          throw error;
        }
      },
      { body: t.Object({ seenJobId: t.Integer({ minimum: 1 }), status }) }
    )
    .patch(
      ROUTES.applicationById,
      async ({ request, params, body, status: reply }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return reply(401, unauthorized());
        }
        const id = positiveId(params.id);
        const row = id
          ? await applications.move(user.discordId, id, body.status)
          : null;
        return row ?? reply(404, notFound);
      },
      { body: t.Object({ status }), params: t.Object({ id: t.String() }) }
    )
    .delete(
      ROUTES.applicationById,
      async ({ request, params, status: reply }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return reply(401, unauthorized());
        }
        const id = positiveId(params.id);
        return id && (await applications.remove(user.discordId, id))
          ? { ok: true }
          : reply(404, notFound);
      },
      { params: t.Object({ id: t.String() }) }
    );
};
