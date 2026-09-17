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
  DeleteAccountResponse,
  DeleteSubscriptionResponse,
  ErrorEnvelope,
  PATHS,
  SubscriptionsResponse,
  SubscriptionDto,
  UpdateSubscriptionBody,
  type AccountSummaryType,
  type AuthMeResponseType,
  type CreateSubscriptionBodyType,
  type SubscriptionDtoType,
  type SubscriptionsResponseType,
  type UpdateSubscriptionBodyType,
} from '@kappa/contracts';

export type {
  AccountSummaryType,
  CreateSubscriptionBodyType,
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

export function fetchSubscriptions(): Promise<SubscriptionsResponseType['subscriptions']> {
  return runApi(
    request(HttpClientRequest.get(PATHS.subscriptions), SubscriptionsResponse),
  ).then((res) => res.subscriptions);
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

export function fetchAccountSummary(): Promise<AccountSummaryType> {
  return runApi(request(HttpClientRequest.get(PATHS.accountSummary), AccountSummary));
}

export function deleteAccount(): Promise<void> {
  return runApi(
    request(HttpClientRequest.del(PATHS.account), DeleteAccountResponse),
  ).then(() => undefined);
}
