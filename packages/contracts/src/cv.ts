import { Schema } from "effect";

// Personal CV policy is enforced by the service; clients share these bounds for feedback.
export const CV_MIN_CHARS = 200;
export const CV_MAX_CHARS = 20_000;
export const CV_MAX_FILENAME = 255;
export const CV_MAX_PDF_BYTES = 2_000_000;
// Preserve the web's existing text-upload allowance when extraction moves server-side.
export const CV_MAX_TEXT_BYTES = 512_000;

export const CV_EXTENSIONS = [".pdf", ".txt", ".md"] as const;

export const cvFileKind = (filename: string): "pdf" | "text" | null => {
  const name = filename.trim().toLowerCase();
  const extension = CV_EXTENSIONS.find((value) => name.endsWith(value));
  if (extension === undefined) {
    return null;
  }
  return extension === ".pdf" ? "pdf" : "text";
};

export const cvFileMaxBytes = (filename: string): number =>
  cvFileKind(filename) === "pdf" ? CV_MAX_PDF_BYTES : CV_MAX_TEXT_BYTES;

export const cvSizeLabel = (bytes: number): string =>
  bytes >= 1_000_000
    ? `${Math.round(bytes / 1_000_000)}MB`
    : `${Math.round(bytes / 1024)}KB`;

export const cvFilenameError = (name: string): string | null => {
  if (name.trim().length > CV_MAX_FILENAME) {
    return `filename must be ≤ ${CV_MAX_FILENAME} characters`;
  }
  return cvFileKind(name) ? null : "Upload a `.pdf`, `.txt`, or `.md` file.";
};

export const cvTextError = (text: string): string | null => {
  const { length } = text.trim();
  return length < CV_MIN_CHARS || length > CV_MAX_CHARS
    ? `CV text must be ${CV_MIN_CHARS}–${CV_MAX_CHARS} characters`
    : null;
};

export const cvFileSizeError = (
  filename: string,
  bytes: number
): string | null => {
  const maxBytes = cvFileMaxBytes(filename);
  return bytes > maxBytes
    ? `${cvFileKind(filename) === "pdf" ? "PDF" : "Text file"} must be ${cvSizeLabel(maxBytes)} or smaller`
    : null;
};

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
