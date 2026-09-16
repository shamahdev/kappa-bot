import { Schema } from 'effect';

// Spec §5 error codes. Every service error body is `{ error: { code, message } }`.
export const ErrorCode = Schema.Literal(
  'UNAUTHORIZED',
  'NOT_FOUND',
  'VALIDATION',
  'OAUTH_FAILED',
  'CONFLICT',
);
export type ErrorCode = typeof ErrorCode.Type;

export const ErrorEnvelope = Schema.Struct({
  error: Schema.Struct({
    code: ErrorCode,
    message: Schema.String,
  }),
});
export type ErrorEnvelope = typeof ErrorEnvelope.Type;
