import type { ErrorCodeType } from "@kappa/contracts";

export const err = (
  code: ErrorCodeType,
  message: string
): {
  error: { code: ErrorCodeType; message: string };
} => ({ error: { code, message } });

export const unauthorized = () =>
  err("UNAUTHORIZED", "sign in with Discord first");
