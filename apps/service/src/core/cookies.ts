import { SESSION_COOKIE } from "@kappa/contracts";

// 30d
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Reads the session token from a Cookie header (or null when absent). */
export const readSessionToken = (
  cookieHeader: string | null
): string | null => {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      const value = part.slice(eq + 1).trim();
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
};

const cookieAttrs = (isProd: boolean, maxAge: number): string =>
  // HttpOnly + SameSite=Lax always; Secure only in prod (plain-http dev/VPS-test stays usable).
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProd ? "; Secure" : ""}`;

/** `Set-Cookie` value carrying a fresh session token. */
export const serializeSessionCookie = (
  token: string,
  isProd: boolean
): string =>
  `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttrs(isProd, SESSION_MAX_AGE_SECONDS)}`;

/** `Set-Cookie` value clearing the session (logout / account delete). */
export const clearSessionCookie = (isProd: boolean): string =>
  `${SESSION_COOKIE}=; ${cookieAttrs(isProd, 0)}`;
