// @kappa/contracts — Effect Schemas + inferred DTO types + API path
// constants + error codes shared by apps/service and apps/web.
export { API_V1, PATHS, SESSION_COOKIE } from './paths';
export { ErrorCode, ErrorEnvelope } from './errors';
export type { ErrorCode as ErrorCodeType, ErrorEnvelope as ErrorEnvelopeType } from './errors';
export {
  SUBSCRIPTION_SOURCES,
  isSubscriptionSource,
  SubscriptionSource,
  SubscriptionScope,
  SubscriptionDto,
  SubscriptionsResponse,
  CreateSubscriptionBody,
  UpdateSubscriptionBody,
  DeleteSubscriptionResponse,
} from './subscriptions';
export type {
  SubscriptionSource as SubscriptionSourceType,
  SubscriptionScope as SubscriptionScopeType,
  SubscriptionDto as SubscriptionDtoType,
  SubscriptionsResponse as SubscriptionsResponseType,
  CreateSubscriptionBody as CreateSubscriptionBodyType,
  UpdateSubscriptionBody as UpdateSubscriptionBodyType,
  DeleteSubscriptionResponse as DeleteSubscriptionResponseType,
} from './subscriptions';
export { UserDto, AuthMeResponse } from './auth';
export type { UserDto as UserDtoType, AuthMeResponse as AuthMeResponseType } from './auth';
export { GuildDto, GuildsResponse } from './guilds';
export type { GuildDto as GuildDtoType, GuildsResponse as GuildsResponseType } from './guilds';
export { JobDto, JobsResponse } from './jobs';
export type { JobDto as JobDtoType, JobsResponse as JobsResponseType } from './jobs';
export { AccountSummary, DeleteAccountResponse } from './account';
export type {
  AccountSummary as AccountSummaryType,
  DeleteAccountResponse as DeleteAccountResponseType,
} from './account';
export { CV_MAX_CHARS, CV_MAX_FILENAME, CV_MIN_CHARS, CvDto, SaveCvBody } from './cv';
export type { CvDto as CvDtoType, SaveCvBody as SaveCvBodyType } from './cv';
