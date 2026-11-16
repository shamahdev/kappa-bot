import { Schema } from "effect";

import { JOB_SOURCE_SELECTIONS } from "./job-listings";
import { WorkEnvironment } from "./posting-facts";

export const KEYWORD_ALTERNATIVES_MAX = 10;
export const KEYWORD_MAX_CHARS = 100;
export const SUBSCRIPTION_TITLE_MAX_CHARS = 80;

export const parseKeywordAlternatives = (value: string): string[] => {
  const seen = new Set<string>();
  const alternatives = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => {
      if (!part || seen.has(part.toLowerCase())) {
        return false;
      }
      seen.add(part.toLowerCase());
      return true;
    });
  if (!alternatives.length) {
    throw new Error("Keywords must not be blank.");
  }
  if (alternatives.length > KEYWORD_ALTERNATIVES_MAX) {
    throw new Error(
      `Use at most ${KEYWORD_ALTERNATIVES_MAX} keyword alternatives.`
    );
  }
  if (alternatives.some((part) => part.length > KEYWORD_MAX_CHARS)) {
    throw new Error(
      `Each keyword alternative must be at most ${KEYWORD_MAX_CHARS} characters.`
    );
  }
  return alternatives;
};

const SubscriptionOptions = {
  includeUnspecifiedEnvironment: Schema.optional(Schema.Boolean),
  includeUnspecifiedSalary: Schema.optional(Schema.Boolean),
  minimumSalary: Schema.optional(Schema.NullOr(Schema.Number)),
  title: Schema.optional(Schema.NullOr(Schema.String)),
  workEnvironments: Schema.optional(Schema.Array(WorkEnvironment)),
};

// Existing subscription retention policy, shared with form feedback and storage defaults.
export const RETENTION_DAYS_MIN = 1;
export const RETENTION_DAYS_MAX = 365;
export const DEFAULT_RETENTION_DAYS = 14;
export const DEFAULT_POLL_INTERVAL_MINUTES = 30;

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
  ...SubscriptionOptions,
  channelId: Schema.String,
  // ISO 8601
  createdAt: Schema.String,
  evaluation: Schema.optional(
    Schema.Struct({
      failed: Schema.Number,
      pending: Schema.Number,
      unavailable: Schema.NullOr(Schema.String),
    })
  ),
  guildId: Schema.String,
  id: Schema.Number,
  isActive: Schema.Boolean,
  keywordAlternatives: Schema.optional(
    Schema.NullOr(Schema.Array(Schema.String))
  ),
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

// POST body — personal by default; server creation requires a managed guild and text channel.
export const CreateSubscriptionBody = Schema.Struct({
  ...SubscriptionOptions,
  channelId: Schema.optional(Schema.String),
  guildId: Schema.optional(Schema.String),
  keywords: Schema.String,
  location: Schema.optional(Schema.String),
  source: Schema.String,
});
export type CreateSubscriptionBodyType = typeof CreateSubscriptionBody.Type;

// PATCH body — channel/source immutable v1; retentionDays 1–365 (service validates).
export const UpdateSubscriptionBody = Schema.Struct({
  ...SubscriptionOptions,
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
