import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import {
  AccountSummary,
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
  SaveCvBody,
  SubscriptionDto,
  SubscriptionsResponse,
  UpdateSubscriptionBody,
} from "@kappa/contracts";
import type {
  AccountSummaryType,
  AuthMeResponseType,
  CreateSubscriptionBodyType,
  CvDtoType,
  CvReportType,
  GuildsResponseType,
  JobsResponseType,
  SaveCvBodyType,
  SubscriptionDtoType,
  SubscriptionsResponseType,
  UpdateSubscriptionBodyType,
} from "@kappa/contracts";
import { Data, Effect, Either, Layer, Schema } from "effect";

export type {
  AccountSummaryType,
  CreateSubscriptionBodyType,
  CvDtoType,
  GuildDtoType,
  JobDtoType,
  JobsResponseType,
  SaveCvBodyType,
  SubscriptionDtoType,
  UpdateSubscriptionBodyType,
} from "@kappa/contracts";

/** Same-origin service login URL; the service 302s to Discord. */
export const loginUrl = `${PATHS.authLogin}?return_to=${encodeURIComponent("/dashboard")}`;

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

/** CDN icon URL for a guild (null when the guild has no icon). */
export const guildIconUrl = (
  id: string,
  icon: string | null
): string | null => {
  if (!icon) {
    return null;
  }
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${ext}?size=64`;
};

/** CDN avatar URL for a user (null when unset). */
export const userAvatarUrl = (
  id: string,
  avatar: string | null
): string | null => {
  if (!avatar) {
    return null;
  }
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=64`;
};

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
  const url = guildId
    ? `${PATHS.subscriptions}?guild=${encodeURIComponent(guildId)}`
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

export const fetchCvReports = (): Promise<readonly CvReportType[]> =>
  runApi(
    request(HttpClientRequest.get(PATHS.cvReports), CvReportsResponse)
  ).then((response) => response.reports);

export const fetchCvReport = (id: number): Promise<CvReportType> =>
  runApi(request(HttpClientRequest.get(PATHS.cvReportById(id)), CvReport));

export const fetchCv = (): Promise<CvDtoType> =>
  runApi(request(HttpClientRequest.get(PATHS.cv), CvDto));

export const saveCv = (input: SaveCvBodyType): Promise<CvDtoType> => {
  const body = Schema.encodeSync(SaveCvBody)(input);
  return runApi(
    Effect.flatMap(withJsonBody(HttpClientRequest.put(PATHS.cv), body), (req) =>
      request(req, CvDto)
    )
  );
};

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
