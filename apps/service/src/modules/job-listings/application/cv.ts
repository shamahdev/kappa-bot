import {
  CV_MAX_FILENAME,
  cvFilenameError,
  cvFileKind,
  cvFileSizeError,
  cvTextError,
} from "@kappa/contracts";
import {
  cvProfiles,
  jobApplications,
  seenJobs,
  subscriptions,
} from "@kappa/db";
import type { Database } from "@kappa/db";
import { eq, sql } from "drizzle-orm";

import {
  dmScopeKey,
  dmUserIdForScope,
  JobSubscriptionError,
} from "../domain/subscription";

export interface CvProfile {
  discordId: string;
  text: string;
  filename: string | null;
  updatedAt: Date;
}

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

  const savePdf = async (
    userId: string,
    bytes: Uint8Array,
    filename?: string | null
  ): Promise<CvProfile> => {
    const sizeError = cvFileSizeError("cv.pdf", bytes.byteLength);
    if (sizeError) {
      throw new JobSubscriptionError("VALIDATION", sizeError);
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
  };

  return {
    get,
    async remove(userId: string): Promise<boolean> {
      return await db.transaction(async (tx) => {
        const rows = await tx
          .delete(cvProfiles)
          .where(eq(cvProfiles.discordId, userId))
          .returning({ id: cvProfiles.discordId });
        // Scores are CV-derived; removing the CV removes the personal match
        // history from job cards and tracked applications. Reports remain as
        // explicit historical documents.
        await tx
          .update(seenJobs)
          .set({
            matchBreakdown: null,
            matchReason: null,
            matchScore: null,
          })
          .where(
            sql`${seenJobs.subscriptionId} in (select ${subscriptions.id} from ${subscriptions} where ${subscriptions.guildId} = ${dmScopeKey(userId)})`
          );
        await tx
          .update(jobApplications)
          .set({ matchGrade: null })
          .where(eq(jobApplications.userId, userId));
        return rows.length > 0;
      });
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
      const sizeError = cvFileSizeError(filename, bytes.byteLength);
      if (sizeError) {
        throw new JobSubscriptionError("VALIDATION", sizeError);
      }
      if (cvFileKind(filename) === "pdf") {
        return await savePdf(userId, bytes, filename);
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
    savePdf,
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
