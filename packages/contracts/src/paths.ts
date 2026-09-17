// API path constants shared by service (route mount) and web (fetch URLs).
// Single origin in prod (nginx): web calls these same-origin, no host prefix.

export const API_V1 = '/api/v1' as const;

export const PATHS = {
  health: '/health',
  metrics: '/metrics',
  authLogin: `${API_V1}/auth/discord/login`,
  authCallback: `${API_V1}/auth/discord/callback`,
  authLogout: `${API_V1}/auth/logout`,
  authMe: `${API_V1}/auth/me`,
  subscriptions: `${API_V1}/subscriptions`,
  subscriptionById: (id: number): string => `${API_V1}/subscriptions/${id}`,
  accountSummary: `${API_V1}/account/summary`,
  account: `${API_V1}/account`,
} as const;

/** Session cookie name (opaque token; HttpOnly, set by service only). */
export const SESSION_COOKIE = 'kappa_session' as const;
