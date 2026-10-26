import { discordConnections, sessions, users } from "@kappa/db";
import { and, count, eq, gt } from "drizzle-orm";
import { Elysia } from "elysia";

import { resolveSession } from "../core/auth";
import { clearSessionCookie, readSessionToken } from "../core/cookies";
import { err } from "../core/errors";
import { revokeDiscordToken } from "../discord/api";
import { removeJobListingAccountData } from "../modules/job-listings/application/cleanup";
import { createJobQueries } from "../modules/job-listings/application/queries";
import type { RouteDeps } from "./deps";

export const accountRoutes = (deps: RouteDeps) => {
  const { config, db, log } = deps;
  const jobs = createJobQueries(db);

  return new Elysia({ prefix: "/api/v1" })
    .get("/account/summary", async ({ request, status }) => {
      const user = await resolveSession(
        db,
        readSessionToken(request.headers.get("cookie"))
      );
      if (!user) {
        return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
      }
      const uid = user.discordId;
      const [jobCounts, conns, [sessCount]] = await Promise.all([
        jobs.accountCounts(uid),
        db
          .select({ provider: discordConnections.provider })
          .from(discordConnections)
          .where(eq(discordConnections.userId, uid)),
        db
          .select({ n: count() })
          .from(sessions)
          .where(
            and(eq(sessions.userId, uid), gt(sessions.expiresAt, new Date()))
          ),
      ]);
      return {
        discordId: uid,
        username: user.username,
        ...jobCounts,
        connections: conns.map((c) => c.provider),
        sessionsActive: sessCount.n,
      };
    })
    .delete("/account", async ({ request, set, status }) => {
      const user = await resolveSession(
        db,
        readSessionToken(request.headers.get("cookie"))
      );
      if (!user) {
        return status(401, err("UNAUTHORIZED", "sign in with Discord first"));
      }
      const uid = user.discordId;
      // Local deletion commits atomically; remote revoke is best-effort afterward.
      const conn = await db.transaction(async (tx) => {
        const [connection] = await tx
          .select({ accessToken: discordConnections.accessToken })
          .from(discordConnections)
          .where(eq(discordConnections.userId, uid));
        await tx.delete(sessions).where(eq(sessions.userId, uid));
        await tx
          .delete(discordConnections)
          .where(eq(discordConnections.userId, uid));
        await removeJobListingAccountData(tx, uid);
        await tx.delete(users).where(eq(users.discordId, uid));
        return connection;
      });
      try {
        await revokeDiscordToken({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          token: conn?.accessToken ?? null,
        });
      } catch (error) {
        log.warn(
          { error, userId: uid },
          "discord token revoke failed (best-effort)"
        );
      }
      log.info({ userId: uid }, "account deleted");
      set.headers["set-cookie"] = clearSessionCookie(config.isProd);
      return { ok: true };
    });
};
