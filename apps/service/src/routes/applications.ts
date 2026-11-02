import { APPLICATION_STATUSES } from "@kappa/contracts";
import { Elysia, t } from "elysia";

import { resolveSession } from "../core/auth";
import { readSessionToken } from "../core/cookies";
import { err } from "../core/errors";
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
  const sessionUser = (request: Request) =>
    resolveSession(db, readSessionToken(request.headers.get("cookie")));
  const unauthorized = err("UNAUTHORIZED", "sign in with Discord first");
  const notFound = err("NOT_FOUND", "application not found");

  return new Elysia({ prefix: "/api/v1/applications" })
    .get("/", async ({ request, status: reply }) => {
      const user = await sessionUser(request);
      if (!user) {
        return reply(401, unauthorized);
      }
      return { applications: await applications.list(user.discordId) };
    })
    .post(
      "/",
      async ({ request, body, status: reply }) => {
        const user = await sessionUser(request);
        if (!user) {
          return reply(401, unauthorized);
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
      "/:id",
      async ({ request, params, body, status: reply }) => {
        const user = await sessionUser(request);
        if (!user) {
          return reply(401, unauthorized);
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
      "/:id",
      async ({ request, params, status: reply }) => {
        const user = await sessionUser(request);
        if (!user) {
          return reply(401, unauthorized);
        }
        const id = positiveId(params.id);
        return id && (await applications.remove(user.discordId, id))
          ? { ok: true }
          : reply(404, notFound);
      },
      { params: t.Object({ id: t.String() }) }
    );
};
