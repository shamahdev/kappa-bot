import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { cvProfiles } from '@kappa/db';
import { CV_MAX_CHARS, CV_MAX_FILENAME, CV_MIN_CHARS, type CvDtoType } from '@kappa/contracts';
import { readSessionToken } from '../core/cookies';
import { err } from '../core/errors';
import { resolveSession } from '../core/auth';
import type { RouteDeps } from './deps';

type CvRow = typeof cvProfiles.$inferSelect;

const EMPTY: CvDtoType = { hasCv: false, filename: null, charCount: 0, updatedAt: null, text: null };

function toDto(row: CvRow): CvDtoType {
  return {
    hasCv: true,
    filename: row.filename,
    charCount: row.text.length,
    updatedAt: row.updatedAt.toISOString(),
    text: row.text,
  };
}

// Personal-only CV: session user owns exactly one row, no guild param exists.
export function cvRoutes(deps: RouteDeps) {
  const { db } = deps;

  return new Elysia({ prefix: '/api/v1' })
    .get('/cv', async ({ request, status }) => {
      const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
      if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
      const [row] = await db.select().from(cvProfiles).where(eq(cvProfiles.discordId, user.discordId));
      return row ? toDto(row) : EMPTY;
    })
    .put(
      '/cv',
      async ({ request, body, status }) => {
        const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
        if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
        const text = body.text.trim();
        if (text.length < CV_MIN_CHARS || text.length > CV_MAX_CHARS) {
          return status(
            400,
            err('VALIDATION', `CV text must be ${CV_MIN_CHARS}–${CV_MAX_CHARS} characters`),
          );
        }
        const filename = body.filename?.trim() || null;
        if (filename && filename.length > CV_MAX_FILENAME) {
          return status(400, err('VALIDATION', `filename must be ≤ ${CV_MAX_FILENAME} characters`));
        }
        const [row] = await db
          .insert(cvProfiles)
          .values({ discordId: user.discordId, text, filename, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: cvProfiles.discordId,
            set: { text, filename, updatedAt: new Date() },
          })
          .returning();
        return toDto(row);
      },
      { body: t.Object({ text: t.String(), filename: t.Optional(t.String()) }) },
    )
    .delete('/cv', async ({ request, status }) => {
      const user = await resolveSession(db, readSessionToken(request.headers.get('cookie')));
      if (!user) return status(401, err('UNAUTHORIZED', 'sign in with Discord first'));
      await db.delete(cvProfiles).where(eq(cvProfiles.discordId, user.discordId));
      return EMPTY;
    });
}
