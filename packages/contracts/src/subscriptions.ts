import { Schema } from 'effect';

// Source Adapters behind the shared search/detail seam (spec §5 + discord adapter/index.ts).
export const SUBSCRIPTION_SOURCES = [
  'all',
  'linkedin',
  'kalibrr',
  'techinasia',
  'glints',
  'indeed',
  'jobstreet',
] as const;

export function isSubscriptionSource(value: string): value is SubscriptionSource {
  return (SUBSCRIPTION_SOURCES as readonly string[]).includes(value);
}

export const SubscriptionSource = Schema.Literal(
  'all',
  'linkedin',
  'kalibrr',
  'techinasia',
  'glints',
  'indeed',
  'jobstreet',
);
export type SubscriptionSource = typeof SubscriptionSource.Type;

export const SubscriptionScope = Schema.Literal('dm', 'guild');
export type SubscriptionScope = typeof SubscriptionScope.Type;

// Subscription DTO (spec §5). `scope` derives from guildId (`dm:<uid>` → dm).
export const SubscriptionDto = Schema.Struct({
  id: Schema.Number,
  scope: SubscriptionScope,
  guildId: Schema.String,
  channelId: Schema.String,
  source: Schema.String,
  keywords: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  isActive: Schema.Boolean,
  retentionDays: Schema.Number,
  createdAt: Schema.String, // ISO 8601
});
export type SubscriptionDto = typeof SubscriptionDto.Type;

export const SubscriptionsResponse = Schema.Struct({
  subscriptions: Schema.Array(SubscriptionDto),
});
export type SubscriptionsResponse = typeof SubscriptionsResponse.Type;

// POST body — DM scope only v1 (location defaults `Indonesia` in service).
export const CreateSubscriptionBody = Schema.Struct({
  source: Schema.String,
  keywords: Schema.String,
});
export type CreateSubscriptionBody = typeof CreateSubscriptionBody.Type;

// PATCH body — channel/source immutable v1; retentionDays 1–365 (service validates).
export const UpdateSubscriptionBody = Schema.Struct({
  keywords: Schema.optional(Schema.String),
  location: Schema.optional(Schema.String),
  isActive: Schema.optional(Schema.Boolean),
  retentionDays: Schema.optional(Schema.Number),
});
export type UpdateSubscriptionBody = typeof UpdateSubscriptionBody.Type;

export const DeleteSubscriptionResponse = Schema.Struct({
  summary: Schema.String,
});
export type DeleteSubscriptionResponse = typeof DeleteSubscriptionResponse.Type;
