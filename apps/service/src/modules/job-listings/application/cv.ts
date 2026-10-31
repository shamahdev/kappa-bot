import {
  CV_MAX_CHARS,
  CV_MAX_FILENAME,
  CV_MAX_PDF_BYTES,
  CV_MAX_TEXT_BYTES,
  CV_MIN_CHARS,
} from "@kappa/contracts";
import { cvProfiles } from "@kappa/db";
import type { Database } from "@kappa/db";
import { eq } from "drizzle-orm";

import { dmUserIdForScope, JobSubscriptionError } from "../domain/subscription";

export const CV_MAX_UPLOAD_BYTES = CV_MAX_PDF_BYTES;

export interface CvProfile {
  discordId: string;
  text: string;
  filename: string | null;
  updatedAt: Date;
}

/** Attachment format check shared with Discord; pasted text has no extension requirement. */
export const cvFilenameError = (name: string): string | null => {
  if (name.trim().length > CV_MAX_FILENAME) {
    return `filename must be ≤ ${CV_MAX_FILENAME} characters`;
  }
  const lower = name.trim().toLowerCase();
  if (
    lower.endsWith(".pdf") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md")
  ) {
    return null;
  }
  return "Upload a `.pdf`, `.txt`, or `.md` file.";
};

export const cvTextError = (text: string): string | null => {
  const { length } = text.trim();
  return length < CV_MIN_CHARS || length > CV_MAX_CHARS
    ? `CV text must be ${CV_MIN_CHARS}–${CV_MAX_CHARS} characters`
    : null;
};

const filenameForSave = (filename?: string | null): string | null => {
  const normalized = filename?.trim() || null;
  if (normalized && normalized.length > CV_MAX_FILENAME) {
    throw new JobSubscriptionError(
      "VALIDATION",
      `filename must be ≤ ${CV_MAX_FILENAME} characters`
    );
  }
  return normalized;
};

export const createCvProfiles = (db: Database) => {
  const get = async (userId: string): Promise<CvProfile | null> => {
    const [row] = await db
      .select()
      .from(cvProfiles)
      .where(eq(cvProfiles.discordId, userId));
    return row ?? null;
  };

  const save = async (
    userId: string,
    text: string,
    filename?: string | null
  ): Promise<CvProfile> => {
    const normalized = text.trim();
    const error = cvTextError(normalized);
    if (error) {
      throw new JobSubscriptionError("VALIDATION", error);
    }
    const name = filenameForSave(filename);
    const updatedAt = new Date();
    const [row] = await db
      .insert(cvProfiles)
      .values({
        discordId: userId,
        filename: name,
        text: normalized,
        updatedAt,
      })
      .onConflictDoUpdate({
        set: { filename: name, text: normalized, updatedAt },
        target: cvProfiles.discordId,
      })
      .returning();
    return row;
  };

  return {
    get,
    async remove(userId: string): Promise<boolean> {
      const rows = await db
        .delete(cvProfiles)
        .where(eq(cvProfiles.discordId, userId))
        .returning({ id: cvProfiles.discordId });
      return rows.length > 0;
    },
    save,
    async saveFile(
      userId: string,
      bytes: Uint8Array,
      filename: string
    ): Promise<CvProfile> {
      const error = cvFilenameError(filename);
      if (error) {
        throw new JobSubscriptionError("VALIDATION", error);
      }
      const isPdf = filename.trim().toLowerCase().endsWith(".pdf");
      const maxBytes = isPdf ? CV_MAX_PDF_BYTES : CV_MAX_TEXT_BYTES;
      if (bytes.byteLength > maxBytes) {
        throw new JobSubscriptionError(
          "VALIDATION",
          isPdf
            ? "PDF must be 2MB or smaller"
            : "Text file must be 500KB or smaller"
        );
      }
      if (isPdf) {
        return await this.savePdf(userId, bytes, filename);
      }
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new JobSubscriptionError(
          "VALIDATION",
          "Could not read this text file. Upload UTF-8 .txt or .md."
        );
      }
      return save(userId, text, filename);
    },
    async savePdf(
      userId: string,
      bytes: Uint8Array,
      filename?: string | null
    ): Promise<CvProfile> {
      if (bytes.byteLength > CV_MAX_UPLOAD_BYTES) {
        throw new JobSubscriptionError(
          "VALIDATION",
          "PDF must be 2MB or smaller"
        );
      }
      const name = filenameForSave(filename);
      let text: string;
      try {
        const { extractPdfText } = await import("../infrastructure/pdf");
        text = await extractPdfText(bytes);
      } catch (error) {
        throw new JobSubscriptionError(
          "VALIDATION",
          error instanceof Error ? error.message : "Could not read this PDF."
        );
      }
      return save(userId, text, name);
    },
    async textForScope(scopeKey: string): Promise<string | null> {
      const userId = dmUserIdForScope(scopeKey);
      if (!userId) {
        return null;
      }
      try {
        const profile = await get(userId);
        return profile?.text ?? null;
      } catch {
        // Best-effort scoring must never block delivery.
        return null;
      }
    },
  };
};
