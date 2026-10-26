// API path constants shared by service (route mount) and web (fetch URLs).
// Single origin in prod (nginx): web calls these same-origin, no host prefix.

export const API_V1 = "/api/v1" as const;

export const PATHS = {
  account: `${API_V1}/account`,
  accountSummary: `${API_V1}/account/summary`,
  authCallback: `${API_V1}/auth/discord/callback`,
  authLogin: `${API_V1}/auth/discord/login`,
  authLogout: `${API_V1}/auth/logout`,
  authMe: `${API_V1}/auth/me`,
  cv: `${API_V1}/cv`,
  cvFile: `${API_V1}/cv/file`,
  guilds: `${API_V1}/guilds`,
  health: "/health",
  jobs: `${API_V1}/jobs`,
  metrics: "/metrics",
  subscriptionById: (id: number): string => `${API_V1}/subscriptions/${id}`,
  subscriptions: `${API_V1}/subscriptions`,
} as const;

/** Session cookie name (opaque token; HttpOnly, set by service only). */
export const SESSION_COOKIE = "kappa_session" as const;
