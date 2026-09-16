import type { ErrorCodeType } from '@kappa/contracts';

/** Spec §5 error envelope: `{ error: { code, message } }`. */
export function err(code: ErrorCodeType, message: string): {
  error: { code: ErrorCodeType; message: string };
} {
  return { error: { code, message } };
}
