import { Schema } from "effect";

// Personal CV policy is enforced by the service; clients share these bounds for feedback.
export const CV_MIN_CHARS = 200;
export const CV_MAX_CHARS = 20_000;
export const CV_MAX_FILENAME = 255;
export const CV_MAX_PDF_BYTES = 2_000_000;

// Owner-only view: GET echoes the stored text so the dashboard can edit it.
export const CvDto = Schema.Struct({
  charCount: Schema.Number,
  filename: Schema.NullOr(Schema.String),
  hasCv: Schema.Boolean,
  text: Schema.NullOr(Schema.String),
  // ISO 8601
  updatedAt: Schema.NullOr(Schema.String),
});
export type CvDtoType = typeof CvDto.Type;

// PUT body — service trims and enforces CV_MIN/MAX_CHARS.
export const SaveCvBody = Schema.Struct({
  filename: Schema.optional(Schema.String),
  text: Schema.String,
});
export type SaveCvBodyType = typeof SaveCvBody.Type;
