import type { UserDtoType } from "@kappa/contracts";
import { sessions, users } from "@kappa/db";
import type { Database } from "@kappa/db";
import { eq } from "drizzle-orm";

import { readSessionToken } from "./cookies";
import { hashToken } from "./crypto";

export type AuthedUser = UserDtoType;

/**
 * Resolves the opaque cookie token to its user (null when missing, unknown,
 * or expired). Expired rows are deleted best-effort on sight.
 */
export const resolveSession = async (
  db: Database,
  token: string | null
): Promise<AuthedUser | null> => {
  if (!token) {
    return null;
  }
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.discordId))
    .where(eq(sessions.tokenHash, hashToken(token)));
  if (!row) {
    return null;
  }
  if (row.session.expiresAt.getTime() <= Date.now()) {
    await db
      .delete(sessions)
      .where(eq(sessions.tokenHash, row.session.tokenHash));
    return null;
  }
  return {
    avatar: row.user.avatar,
    discordId: row.user.discordId,
    username: row.user.username,
  };
};

export const sessionUser = (db: Database, request: Request) =>
  resolveSession(db, readSessionToken(request.headers.get("cookie")));
