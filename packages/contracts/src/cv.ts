import { Schema } from 'effect';

// Personal CV for AI match scores (DM-only feature: no guild param anywhere,
// session user owns exactly one row). Limits duplicated in
// apps/discord/.../job-subscription/cv.ts (discord can't import contracts).
export const CV_MIN_CHARS = 200;
export const CV_MAX_CHARS = 20000;
export const CV_MAX_FILENAME = 255;
export const CV_MAX_PDF_BYTES = 2_000_000;

// Owner-only view: GET echoes the stored text so the dashboard can edit it.
export const CvDto = Schema.Struct({
  hasCv: Schema.Boolean,
  filename: Schema.NullOr(Schema.String),
  charCount: Schema.Number,
  updatedAt: Schema.NullOr(Schema.String), // ISO 8601
  text: Schema.NullOr(Schema.String),
});
export type CvDto = typeof CvDto.Type;

// PUT body — service trims and enforces CV_MIN/MAX_CHARS.
export const SaveCvBody = Schema.Struct({
  text: Schema.String,
  filename: Schema.optional(Schema.String),
});
export type SaveCvBody = typeof SaveCvBody.Type;
