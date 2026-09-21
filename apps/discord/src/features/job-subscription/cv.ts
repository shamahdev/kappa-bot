import { eq } from 'drizzle-orm';
import { cvProfiles } from '@kappa/db';
import type { GatewayDb } from '../../core/feature';

// Keep in sync with @kappa/contracts cv.ts (discord can't import contracts).
export const CV_MIN_CHARS = 200;
export const CV_MAX_CHARS = 20000;
export const CV_MAX_UPLOAD_BYTES = 2_000_000; // PDFs carry fonts/images; mirrors CV_MAX_PDF_BYTES

export type CvProfile = typeof cvProfiles.$inferSelect;

/** Owner uid for a DM-scope guild id (`dm:<uid>`); null for real guilds. */
export function dmUserIdForGuildId(guildId: string): string | null {
  return guildId.startsWith('dm:') && guildId.length > 3 ? guildId.slice(3) : null;
}

export async function loadCv(db: GatewayDb, discordUserId: string): Promise<CvProfile | null> {
  const [row] = await db.select().from(cvProfiles).where(eq(cvProfiles.discordId, discordUserId));
  return row ?? null;
}

/** CV text for one user; null when unset or on any read failure. */
export async function loadCvText(db: GatewayDb, discordUserId: string): Promise<string | null> {
  try {
    return (await loadCv(db, discordUserId))?.text ?? null;
  } catch {
    return null; // scoring never blocks delivery
  }
}

/** CV text for DM-scope deliveries; null for guild scope or when unset. */
export async function loadCvTextForScope(
  db: GatewayDb,
  guildId: string,
): Promise<string | null> {
  const uid = dmUserIdForGuildId(guildId);
  if (!uid) return null;
  return loadCvText(db, uid);
}

export async function saveCv(
  db: GatewayDb,
  discordUserId: string,
  text: string,
  filename: string | null,
): Promise<void> {
  await db
    .insert(cvProfiles)
    .values({ discordId: discordUserId, text, filename, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cvProfiles.discordId,
      set: { text, filename, updatedAt: new Date() },
    });
}

export async function deleteCv(db: GatewayDb, discordUserId: string): Promise<boolean> {
  const deleted = await db
    .delete(cvProfiles)
    .where(eq(cvProfiles.discordId, discordUserId))
    .returning({ id: cvProfiles.discordId });
  return deleted.length > 0;
}

/** `.pdf` (text-extracted), `.txt`/`.md` (read directly). */
export function cvFilenameError(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf') || lower.endsWith('.txt') || lower.endsWith('.md')) return null;
  return 'Upload a `.pdf`, `.txt`, or `.md` file.';
}

export function cvTextError(text: string): string | null {
  if (text.length < CV_MIN_CHARS) {
    return `That CV is too short (${text.length} chars) — need at least ${CV_MIN_CHARS}.`;
  }
  if (text.length > CV_MAX_CHARS) {
    return `That CV is too long (${text.length} chars) — max ${CV_MAX_CHARS}.`;
  }
  return null;
}
