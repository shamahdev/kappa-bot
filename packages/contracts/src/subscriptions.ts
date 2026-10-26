import { Schema } from "effect";

import { JOB_SOURCE_SELECTIONS } from "./job-listings";

export const SUBSCRIPTION_SOURCES = JOB_SOURCE_SELECTIONS;

export const isSubscriptionSource = (
  value: string
): value is SubscriptionSourceType =>
  (SUBSCRIPTION_SOURCES as readonly string[]).includes(value);

export const SubscriptionSource = Schema.Literal(...JOB_SOURCE_SELECTIONS);
export type SubscriptionSourceType = typeof SubscriptionSource.Type;

export const SubscriptionScope = Schema.Literal("dm", "guild");
export type SubscriptionScopeType = typeof SubscriptionScope.Type;

// Job-subscription wire shape; legacy storage scope is mapped by the service.
export const SubscriptionDto = Schema.Struct({
  channelId: Schema.String,
  // ISO 8601
  createdAt: Schema.String,
  guildId: Schema.String,
  id: Schema.Number,
  isActive: Schema.Boolean,
  keywords: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  retentionDays: Schema.Number,
  scope: SubscriptionScope,
  source: Schema.String,
});
export type SubscriptionDtoType = typeof SubscriptionDto.Type;

export const SubscriptionsResponse = Schema.Struct({
  subscriptions: Schema.Array(SubscriptionDto),
});
export type SubscriptionsResponseType = typeof SubscriptionsResponse.Type;

// POST body — DM scope only v1 (location defaults `Indonesia` in service).
export const CreateSubscriptionBody = Schema.Struct({
  keywords: Schema.String,
  source: Schema.String,
});
export type CreateSubscriptionBodyType = typeof CreateSubscriptionBody.Type;

// PATCH body — channel/source immutable v1; retentionDays 1–365 (service validates).
export const UpdateSubscriptionBody = Schema.Struct({
  isActive: Schema.optional(Schema.Boolean),
  keywords: Schema.optional(Schema.String),
  location: Schema.optional(Schema.String),
  retentionDays: Schema.optional(Schema.Number),
});
export type UpdateSubscriptionBodyType = typeof UpdateSubscriptionBody.Type;

export const DeleteSubscriptionResponse = Schema.Struct({
  summary: Schema.String,
});
export type DeleteSubscriptionResponseType =
  typeof DeleteSubscriptionResponse.Type;
