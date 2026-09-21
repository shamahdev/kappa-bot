import { Data, Effect, Layer, Schema } from 'effect';
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import {
  AccountSummary,
  AuthMeResponse,
  CreateSubscriptionBody,
  CvDto,
  DeleteAccountResponse,
  DeleteSubscriptionResponse,
  ErrorEnvelope,
  GuildsResponse,
  JobsResponse,
  PATHS,
  SaveCvBody,
  SubscriptionsResponse,
  SubscriptionDto,
  UpdateSubscriptionBody,
  type AccountSummaryType,
  type AuthMeResponseType,
  type CreateSubscriptionBodyType,
  type CvDtoType,
  type GuildDtoType,
  type GuildsResponseType,
  type JobDtoType,
  type JobsResponseType,
  type SaveCvBodyType,
  type SubscriptionDtoType,
  type SubscriptionsResponseType,
  type UpdateSubscriptionBodyType,
} from '@kappa/contracts';

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
};

/** Same-origin service login URL (spec §5); the service 302s to Discord. */
export const loginUrl = `${PATHS.authLogin}?return_to=${encodeURIComponent('/dashboard')}`;

export type Me = AuthMeResponseType['user'];

/** Typed API failure: service error envelope, decode failure, or transport error. */
export class ApiError extends Data.TaggedError('ApiError')<{
  status: number;
  code: string;
  message: string;
}> {
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isReconnectRequired(): boolean {
    return this.code === 'RECONNECT_REQUIRED';
  }
}

/** CDN icon URL for a guild (null when the guild has no icon). */
export function guildIconUrl(id: string, icon: string | null): string | null {
  if (!icon) return null;
  const ext = icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${ext}?size=64`;
}

/** CDN avatar URL for a user (null when unset). */
export function userAvatarUrl(id: string, avatar: string | null): string | null {
  if (!avatar) return null;
  const ext = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=64`;
}

const OkResponse = Schema.Struct({ ok: Schema.Boolean });

/**
 * HttpClient layer for the browser: same-origin `/api` (nginx in prod, vite
 * proxy in dev) with `credentials: 'include'` so the HttpOnly session cookie
 * flows. No tokens are ever handled in JS (spec §6).
 */
const ApiLive = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { credentials: 'include' }),
);

const toApiError = (status: number, code: string, message: string): ApiError =>
  new ApiError({ status, code, message });

const decodeEnvelope = (
  res: HttpClientResponse.HttpClientResponse,
): Effect.Effect<ApiError> =>
  Effect.orElseSucceed(
    Effect.map(
      HttpClientResponse.schemaBodyJson(ErrorEnvelope)(res),
      (env) => toApiError(res.status, env.error.code, env.error.message),
    ),
    () => toApiError(res.status, 'UNKNOWN', `request failed with status ${res.status}`),
  );

/** Execute a request, decode the JSON body with a contracts Schema. */
function request<A, I>(
  req: HttpClientRequest.HttpClientRequest,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, ApiError, HttpClient.HttpClient> {
  return Effect.catchAll(
    Effect.flatMap(HttpClient.execute(req), (res) =>
      res.status >= 200 && res.status < 300
        ? Effect.mapError(
            HttpClientResponse.schemaBodyJson(schema)(res),
            (cause) =>
              toApiError(res.status, 'DECODE', `unexpected response shape: ${String(cause)}`),
          )
        : Effect.flatMap(decodeEnvelope(res), (apiError) => Effect.fail(apiError)),
    ),
    (cause) =>
      Effect.fail(
        cause instanceof ApiError
          ? cause
          : toApiError(0, 'NETWORK', `service unreachable: ${String(cause)}`),
      ),
  );
}

const withJsonBody = (
  req: HttpClientRequest.HttpClientRequest,
  body: unknown,
): Effect.Effect<HttpClientRequest.HttpClientRequest, ApiError> =>
  Effect.mapError(
    HttpClientRequest.bodyJson(req, body),
    (cause) => toApiError(0, 'ENCODE', `cannot encode body: ${String(cause)}`),
  );

/** Run an API effect against the live client (for react-query fetchers). */
export function runApi<A>(
  effect: Effect.Effect<A, ApiError, HttpClient.HttpClient>,
): Promise<A> {
  return Effect.runPromise(Effect.provide(effect, ApiLive));
}

export function fetchMe(): Promise<Me | null> {
  return runApi(request(HttpClientRequest.get(PATHS.authMe), AuthMeResponse)).then(
    (res) => res.user,
    (error: ApiError) => {
      if (error.isUnauthorized) return null;
      throw error;
    },
  );
}

export function logout(): Promise<void> {
  return runApi(request(HttpClientRequest.post(PATHS.authLogout), OkResponse)).then(
    () => undefined,
  );
}

export function fetchSubscriptions(guildId?: string): Promise<SubscriptionsResponseType['subscriptions']> {
  const url = guildId ? `${PATHS.subscriptions}?guild=${encodeURIComponent(guildId)}` : PATHS.subscriptions;
  return runApi(request(HttpClientRequest.get(url), SubscriptionsResponse)).then(
    (res) => res.subscriptions,
  );
}

export function fetchGuilds(): Promise<GuildsResponseType['guilds']> {
  return runApi(request(HttpClientRequest.get(PATHS.guilds), GuildsResponse)).then(
    (res) => res.guilds,
  );
}

export type JobsParams = {
  scope?: 'dm';
  guild?: string;
  subscription?: number;
  source?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export function fetchJobs(params: JobsParams): Promise<JobsResponseType> {
  const search = new URLSearchParams();
  if (params.scope) search.set('scope', params.scope);
  if (params.guild) search.set('guild', params.guild);
  if (params.subscription !== undefined) search.set('subscription', String(params.subscription));
  if (params.source) search.set('source', params.source);
  if (params.q) search.set('q', params.q);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
  return runApi(request(HttpClientRequest.get(`${PATHS.jobs}?${search}`), JobsResponse));
}

export function createSubscription(
  input: CreateSubscriptionBodyType,
): Promise<SubscriptionDtoType> {
  const body = Schema.encodeSync(CreateSubscriptionBody)(input);
  return runApi(
    Effect.flatMap(
      withJsonBody(HttpClientRequest.post(PATHS.subscriptions), body),
      (req) => request(req, SubscriptionDto),
    ),
  );
}

export function updateSubscription(
  id: number,
  input: UpdateSubscriptionBodyType,
): Promise<SubscriptionDtoType> {
  const body = Schema.encodeSync(UpdateSubscriptionBody)(input);
  return runApi(
    Effect.flatMap(
      withJsonBody(HttpClientRequest.patch(PATHS.subscriptionById(id)), body),
      (req) => request(req, SubscriptionDto),
    ),
  );
}

export function deleteSubscription(id: number): Promise<string> {
  return runApi(
    request(HttpClientRequest.del(PATHS.subscriptionById(id)), DeleteSubscriptionResponse),
  ).then((res) => res.summary);
}

export function fetchCv(): Promise<CvDtoType> {
  return runApi(request(HttpClientRequest.get(PATHS.cv), CvDto));
}

export function saveCv(input: SaveCvBodyType): Promise<CvDtoType> {
  const body = Schema.encodeSync(SaveCvBody)(input);
  return runApi(
    Effect.flatMap(
      withJsonBody(HttpClientRequest.put(PATHS.cv), body),
      (req) => request(req, CvDto),
    ),
  );
}

export function deleteCv(): Promise<CvDtoType> {
  return runApi(request(HttpClientRequest.del(PATHS.cv), CvDto));
}

export function saveCvFile(file: File): Promise<CvDtoType> {
  const form = new FormData();
  form.append('file', file);
  return runApi(
    request(HttpClientRequest.bodyFormData(HttpClientRequest.post(PATHS.cvFile), form), CvDto),
  );
}

export function fetchAccountSummary(): Promise<AccountSummaryType> {
  return runApi(request(HttpClientRequest.get(PATHS.accountSummary), AccountSummary));
}

export function deleteAccount(): Promise<void> {
  return runApi(
    request(HttpClientRequest.del(PATHS.account), DeleteAccountResponse),
  ).then(() => undefined);
}
