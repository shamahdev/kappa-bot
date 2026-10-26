import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** Opaque session token: 32 random bytes, base64url for cookie transport. */
export const newSessionToken = (): string =>
  randomBytes(32).toString("base64url");

/** sha256 hex of the token — the only form persisted in `sessions`. */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token, "utf-8").digest("hex");

/**
 * Signed OAuth state: `base64url(returnTo).base64url(hmac)`. Binds the
 * post-login redirect so the callback can't be steered off-origin.
 */
export const signState = (returnTo: string, secret: string): string => {
  const payload = Buffer.from(returnTo, "utf-8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
};

/** Returns the bound returnTo path, or null when the signature is invalid. */
export const verifyState = (state: string, secret: string): string | null => {
  const dot = state.indexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    return Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }
};

/** Accepts only same-origin absolute paths (blocks `//evil` + `https:`). */
export const sanitizeReturnTo = (
  value: string | undefined,
  fallback = "/dashboard"
): string => {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }
  return fallback;
};
