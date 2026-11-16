// API path constants shared by service (route mount) and web (fetch URLs).
// Single origin in prod (nginx): web calls these same-origin, no host prefix.

export const API_V1 = "/api/v1" as const;

export const ROUTES = {
  account: "/account",
  accountSummary: "/account/summary",
  applicationById: "/applications/:id",
  applications: "/applications",
  authCallback: "/auth/discord/callback",
  authLogin: "/auth/discord/login",
  authLogout: "/auth/logout",
  authMe: "/auth/me",
  cv: "/cv",
  cvFile: "/cv/file",
  cvReportById: "/cv/reports/:id",
  cvReportRetry: "/cv/reports/:id/retry",
  cvReports: "/cv/reports",
  guilds: "/guilds",
  jobs: "/jobs",
  subscriptionById: "/subscriptions/:id",
  subscriptions: "/subscriptions",
} as const;

const withId =
  (route: string) =>
  (id: number): string =>
    `${API_V1}${route}`.replaceAll(":id", String(id));

export const PATHS = {
  account: `${API_V1}${ROUTES.account}`,
  accountSummary: `${API_V1}${ROUTES.accountSummary}`,
  applicationById: withId(ROUTES.applicationById),
  applications: `${API_V1}${ROUTES.applications}`,
  authCallback: `${API_V1}${ROUTES.authCallback}`,
  authLogin: `${API_V1}${ROUTES.authLogin}`,
  authLogout: `${API_V1}${ROUTES.authLogout}`,
  authMe: `${API_V1}${ROUTES.authMe}`,
  cv: `${API_V1}${ROUTES.cv}`,
  cvFile: `${API_V1}${ROUTES.cvFile}`,
  cvReportById: withId(ROUTES.cvReportById),
  cvReportRetry: withId(ROUTES.cvReportRetry),
  cvReports: `${API_V1}${ROUTES.cvReports}`,
  guilds: `${API_V1}${ROUTES.guilds}`,
  health: "/health",
  jobs: `${API_V1}${ROUTES.jobs}`,
  metrics: "/metrics",
  subscriptionById: withId(ROUTES.subscriptionById),
  subscriptions: `${API_V1}${ROUTES.subscriptions}`,
} as const;

/** Web app routes (file-based in apps/web); API producers link to these. */
export const WEB_ROUTES = {
  dashboard: "/dashboard",
  report: (id: number): string => `/dashboard/reports/${id}`,
} as const;

export const DEFAULT_RETURN_TO = WEB_ROUTES.dashboard;

/** Session cookie name (opaque token; HttpOnly, set by service only). */
export const SESSION_COOKIE = "kappa_session" as const;
