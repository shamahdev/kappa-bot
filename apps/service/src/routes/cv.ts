import type { CvDtoType } from "@kappa/contracts";
import {
  API_V1,
  ROUTES,
  CV_MAX_PDF_BYTES,
  cvSizeLabel,
} from "@kappa/contracts";
import { Elysia, t } from "elysia";

import { sessionUser } from "../core/auth";
import { err, unauthorized } from "../core/errors";
import { createCvProfiles } from "../modules/job-listings/application/cv";
import type { CvProfile } from "../modules/job-listings/application/cv";
import { JobSubscriptionError } from "../modules/job-listings/domain/subscription";
import type { RouteDeps } from "./deps";

const EMPTY: CvDtoType = { filename: null, hasCv: false, updatedAt: null };
const toDto = (row: CvProfile): CvDtoType => ({
  filename: row.filename,
  hasCv: true,
  updatedAt: row.updatedAt.toISOString(),
});

// Every public response is metadata-only; extraction and validation stay server-side.
export const cvRoutes = (deps: RouteDeps) => {
  const { db } = deps;
  const profiles = createCvProfiles(db);
  return (
    new Elysia({ prefix: API_V1 })
      .get(ROUTES.cv, async ({ request, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        const profile = await profiles.get(user.discordId);
        return profile ? toDto(profile) : EMPTY;
      })
      // Preserve the existing input endpoint, but never echo submitted/stored text.
      .put(
        ROUTES.cv,
        async ({ request, body, status }) => {
          const user = await sessionUser(db, request);
          if (!user) {
            return status(401, unauthorized());
          }
          try {
            return toDto(
              await profiles.save(user.discordId, body.text, body.filename)
            );
          } catch (error) {
            if (
              error instanceof JobSubscriptionError &&
              error.code === "VALIDATION"
            ) {
              return status(400, err("VALIDATION", error.message));
            }
            throw error;
          }
        },
        {
          body: t.Object({
            filename: t.Optional(t.String()),
            text: t.String(),
          }),
        }
      )
      .post(
        ROUTES.cvFile,
        async ({ request, body, status }) => {
          const user = await sessionUser(db, request);
          if (!user) {
            return status(401, unauthorized());
          }
          const { file } = body;
          if (file.size > CV_MAX_PDF_BYTES) {
            return status(
              400,
              err(
                "VALIDATION",
                `File must be ${cvSizeLabel(CV_MAX_PDF_BYTES)} or smaller`
              )
            );
          }
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            return toDto(
              await profiles.saveFile(user.discordId, bytes, file.name)
            );
          } catch (error) {
            if (
              error instanceof JobSubscriptionError &&
              error.code === "VALIDATION"
            ) {
              return status(400, err("VALIDATION", error.message));
            }
            throw error;
          }
        },
        { body: t.Object({ file: t.File() }) }
      )
      .delete(ROUTES.cv, async ({ request, status }) => {
        const user = await sessionUser(db, request);
        if (!user) {
          return status(401, unauthorized());
        }
        await profiles.remove(user.discordId);
        return EMPTY;
      })
  );
};
