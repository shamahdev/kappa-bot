import { Schema } from "effect";

// Personal CV policy is enforced by the service; clients share these bounds for feedback.
export const CV_MIN_CHARS = 200;
export const CV_MAX_CHARS = 20_000;
export const CV_MAX_FILENAME = 255;
export const CV_MAX_PDF_BYTES = 2_000_000;
// Preserve the web's existing text-upload allowance when extraction moves server-side.
export const CV_MAX_TEXT_BYTES = 512_000;

// Public CV responses are metadata-only. Extracted text never leaves the service.
export const CvDto = Schema.Struct({
  filename: Schema.NullOr(Schema.String),
  hasCv: Schema.Boolean,
  updatedAt: Schema.NullOr(Schema.String),
});
export type CvDtoType = typeof CvDto.Type;

// PUT body — service trims and enforces CV_MIN/MAX_CHARS.
export const SaveCvBody = Schema.Struct({
  filename: Schema.optional(Schema.String),
  text: Schema.String,
});
export type SaveCvBodyType = typeof SaveCvBody.Type;
