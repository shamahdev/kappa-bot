import { Schema } from "effect";

// Spec §5 error codes. Every service error body is `{ error: { code, message } }`.
export const ErrorCode = Schema.Literal(
  "UNAUTHORIZED",
  "NOT_FOUND",
  "VALIDATION",
  "OAUTH_FAILED",
  "CONFLICT",
  // Session predates the `guilds` scope (or tokens were revoked): the user must
  // run the Discord login again before server features work.
  "RECONNECT_REQUIRED"
);
export type ErrorCodeType = typeof ErrorCode.Type;

export const ErrorEnvelope = Schema.Struct({
  error: Schema.Struct({
    code: ErrorCode,
    message: Schema.String,
  }),
});
export type ErrorEnvelopeType = typeof ErrorEnvelope.Type;
