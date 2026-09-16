import { eq } from 'drizzle-orm';
import { sessions, users, type GatewayDb } from '@kappa/db';
import { hashToken } from './crypto';

export type AuthedUser = {
  discordId: string;
  username: string;
  avatar: string | null;
};

/**
 * Resolves the opaque cookie token to its user (null when missing, unknown,
 * or expired). Expired rows are deleted best-effort on sight.
 */
export async function resolveSession(db: GatewayDb, token: string | null): Promise<AuthedUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.discordId))
    .where(eq(sessions.tokenHash, hashToken(token)));
  if (!row) return null;
  if (row.session.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, row.session.tokenHash));
    return null;
  }
  return {
    discordId: row.user.discordId,
    username: row.user.username,
    avatar: row.user.avatar,
  };
}
