import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import {
  AccountSummary,
  ApplicationDto,
  ApplicationsResponse,
  AuthMeResponse,
  CreateSubscriptionBody,
  CvDto,
  CvReport,
  CvReportsResponse,
  DeleteAccountResponse,
  DeleteSubscriptionResponse,
  ErrorEnvelope,
  GuildsResponse,
  JobsResponse,
  PATHS,
  SubscriptionDto,
  SubscriptionsResponse,
  UpdateSubscriptionBody,
  DEFAULT_RETURN_TO,
  DEFAULT_CV_REPORT_PAGE_SIZE,
} from "@kappa/contracts";
import type {
  AccountSummaryType,
  ApplicationDtoType,
  ApplicationStatusType,
  AuthMeResponseType,
  CreateSubscriptionBodyType,
  CvDtoType,
  CvReportType,
  CvReportsResponseType,
  GuildsResponseType,
  JobsResponseType,
  SubscriptionDtoType,
  SubscriptionsResponseType,
  UpdateSubscriptionBodyType,
} from "@kappa/contracts";
import { Data, Effect, Either, Layer, Schema } from "effect";

/** Same-origin service login URL; the service 302s to Discord. */
export const loginUrl = `${PATHS.authLogin}?return_to=${encodeURIComponent(DEFAULT_RETURN_TO)}`;

export type Me = AuthMeResponseType["user"];

/** Typed API failure: service error envelope, decode failure, or transport error. */
export class ApiError extends Data.TaggedError("ApiError")<{
  status: number;
  code: string;
  message: string;
}> {
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isReconnectRequired(): boolean {
    return this.code === "RECONNECT_REQUIRED";
  }
}

export const apiMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
};

const cdnAssetUrl = (
  kind: "icons" | "avatars",
  id: string,
  hash: string | null
): string | null => {
  if (!hash) {
    return null;
  }
  const extension = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/${kind}/${id}/${hash}.${extension}?size=64`;
};

export const guildIconUrl = (id: string, icon: string | null): string | null =>
  cdnAssetUrl("icons", id, icon);

export const userAvatarUrl = (
  id: string,
  avatar: string | null
): string | null => cdnAssetUrl("avatars", id, avatar);

const OkResponse = Schema.Struct({ ok: Schema.Boolean });

/**
 * HttpClient layer for the browser: same-origin `/api` with
 * `credentials: 'include'` so the HttpOnly session cookie flows.
 * No tokens are ever handled in JS.
 */
const ApiLive = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })
);

const toApiError = (status: number, code: string, message: string): ApiError =>
  new ApiError({ status, code, message });

const decodeEnvelope = (
  res: HttpClientResponse.HttpClientResponse
): Effect.Effect<ApiError> =>
  Effect.orElseSucceed(
    Effect.map(HttpClientResponse.schemaBodyJson(ErrorEnvelope)(res), (env) =>
      toApiError(res.status, env.error.code, env.error.message)
    ),
    () =>
      toApiError(
        res.status,
        "UNKNOWN",
        `request failed with status ${res.status}`
      )
  );

/** Execute a request, decode the JSON body with a contracts Schema. */
const request = <A, I>(
  req: HttpClientRequest.HttpClientRequest,
  schema: Schema.Schema<A, I>
): Effect.Effect<A, ApiError, HttpClient.HttpClient> =>
  Effect.catchAll(
    Effect.flatMap(HttpClient.execute(req), (res) =>
      res.status >= 200 && res.status < 300
        ? Effect.mapError(
            HttpClientResponse.schemaBodyJson(schema)(res),
            (cause) =>
              toApiError(
                res.status,
                "DECODE",
                `unexpected response shape: ${String(cause)}`
              )
          )
        : Effect.flatMap(decodeEnvelope(res), (apiError) =>
            Effect.fail(apiError)
          )
    ),
    (cause) =>
      Effect.fail(
        cause instanceof ApiError
          ? cause
          : toApiError(0, "NETWORK", `service unreachable: ${String(cause)}`)
      )
  );

const withJsonBody = (
  req: HttpClientRequest.HttpClientRequest,
  body: unknown
): Effect.Effect<HttpClientRequest.HttpClientRequest, ApiError> =>
  Effect.mapError(HttpClientRequest.bodyJson(req, body), (cause) =>
    toApiError(0, "ENCODE", `cannot encode body: ${String(cause)}`)
  );

/** Run an API effect against the live client (for react-query fetchers). */
export const runApi = async <A>(
  effect: Effect.Effect<A, ApiError, HttpClient.HttpClient>
): Promise<A> => {
  // Materialize typed failures before running: runPromise otherwise wraps them
  // in FiberFailure, hiding the ApiError predicates from Promise consumers.
  const result = await Effect.runPromise(
    Effect.either(Effect.provide(effect, ApiLive))
  );
  if (Either.isLeft(result)) {
    throw result.left;
  }
  return result.right;
};

export const fetchMe = async (): Promise<Me | null> => {
  try {
    const res = await runApi(
      request(HttpClientRequest.get(PATHS.authMe), AuthMeResponse)
    );
    return res.user;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      return null;
    }
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  await runApi(request(HttpClientRequest.post(PATHS.authLogout), OkResponse));
};

export const fetchSubscriptions = (
  guildId?: string
): Promise<SubscriptionsResponseType["subscriptions"]> => {
  const search = new URLSearchParams();
  if (guildId) {
    search.set("guild", guildId);
  }
  const url = search.size
    ? `${PATHS.subscriptions}?${search}`
    : PATHS.subscriptions;
  return runApi(
    request(HttpClientRequest.get(url), SubscriptionsResponse)
  ).then((res) => res.subscriptions);
};

export const fetchGuilds = (): Promise<GuildsResponseType["guilds"]> =>
  runApi(request(HttpClientRequest.get(PATHS.guilds), GuildsResponse)).then(
    (res) => res.guilds
  );

export interface JobsParams {
  scope?: "dm";
  guild?: string;
  subscription?: number;
  source?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  tracking?: "tracked" | "untracked";
}

export const fetchJobs = (params: JobsParams): Promise<JobsResponseType> => {
  const search = new URLSearchParams();
  if (params.scope) {
    search.set("scope", params.scope);
  }
  if (params.guild) {
    search.set("guild", params.guild);
  }
  if (params.subscription !== undefined) {
    search.set("subscription", String(params.subscription));
  }
  if (params.source) {
    search.set("source", params.source);
  }
  if (params.q) {
    search.set("q", params.q);
  }
  if (params.page !== undefined) {
    search.set("page", String(params.page));
  }
  if (params.pageSize !== undefined) {
    search.set("pageSize", String(params.pageSize));
  }
  if (params.tracking) {
    search.set("tracking", params.tracking);
  }
  return runApi(
    request(HttpClientRequest.get(`${PATHS.jobs}?${search}`), JobsResponse)
  );
};

export const createSubscription = (
  input: CreateSubscriptionBodyType
): Promise<SubscriptionDtoType> => {
  const body = Schema.encodeSync(CreateSubscriptionBody)(input);
  return runApi(
    Effect.flatMap(
      withJsonBody(HttpClientRequest.post(PATHS.subscriptions), body),
      (req) => request(req, SubscriptionDto)
    )
  );
};

export const updateSubscription = (
  id: number,
  input: UpdateSubscriptionBodyType
): Promise<SubscriptionDtoType> => {
  const body = Schema.encodeSync(UpdateSubscriptionBody)(input);
  return runApi(
    Effect.flatMap(
      withJsonBody(HttpClientRequest.patch(PATHS.subscriptionById(id)), body),
      (req) => request(req, SubscriptionDto)
    )
  );
};

export const deleteSubscription = (id: number): Promise<string> =>
  runApi(
    request(
      HttpClientRequest.del(PATHS.subscriptionById(id)),
      DeleteSubscriptionResponse
    )
  ).then((res) => res.summary);

export const fetchCvReports = (
  page = 1,
  pageSize = DEFAULT_CV_REPORT_PAGE_SIZE
): Promise<CvReportsResponseType> =>
  runApi(
    request(
      HttpClientRequest.get(
        `${PATHS.cvReports}?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`
      ),
      CvReportsResponse
    )
  );

export const fetchCvReport = (id: number): Promise<CvReportType> =>
  runApi(request(HttpClientRequest.get(PATHS.cvReportById(id)), CvReport));

/** Manually close the current report window; generation continues server-side. */
export const createCvReport = (): Promise<CvReportType> =>
  runApi(request(HttpClientRequest.post(PATHS.cvReports), CvReport));

/** Requeue a cv_required/unavailable report after the CV changes. */
export const retryCvReport = (id: number): Promise<CvReportType> =>
  runApi(request(HttpClientRequest.post(PATHS.cvReportRetry(id)), CvReport));

export const fetchCv = (): Promise<CvDtoType> =>
  runApi(request(HttpClientRequest.get(PATHS.cv), CvDto));

export const deleteCv = (): Promise<CvDtoType> =>
  runApi(request(HttpClientRequest.del(PATHS.cv), CvDto));

export const saveCvFile = (file: File): Promise<CvDtoType> => {
  const form = new FormData();
  form.append("file", file);
  return runApi(
    request(
      HttpClientRequest.bodyFormData(
        HttpClientRequest.post(PATHS.cvFile),
        form
      ),
      CvDto
    )
  );
};

export const fetchAccountSummary = (): Promise<AccountSummaryType> =>
  runApi(request(HttpClientRequest.get(PATHS.accountSummary), AccountSummary));

export const deleteAccount = async (): Promise<void> => {
  await runApi(
    request(HttpClientRequest.del(PATHS.account), DeleteAccountResponse)
  );
};

export const fetchApplications = (): Promise<readonly ApplicationDtoType[]> =>
  runApi(
    request(HttpClientRequest.get(PATHS.applications), ApplicationsResponse)
  ).then((response) => response.applications);

export const trackApplication = (
  seenJobId: number,
  status: ApplicationStatusType
): Promise<ApplicationDtoType> =>
  runApi(
    Effect.flatMap(
      withJsonBody(HttpClientRequest.post(PATHS.applications), {
        seenJobId,
        status,
      }),
      (req) => request(req, ApplicationDto)
    )
  );

export const moveApplication = (
  id: number,
  status: ApplicationStatusType
): Promise<ApplicationDtoType> =>
  runApi(
    Effect.flatMap(
      withJsonBody(HttpClientRequest.patch(PATHS.applicationById(id)), {
        status,
      }),
      (req) => request(req, ApplicationDto)
    )
  );

export const removeApplication = (id: number): Promise<boolean> =>
  runApi(
    request(HttpClientRequest.del(PATHS.applicationById(id)), OkResponse)
  ).then((response) => response.ok);
