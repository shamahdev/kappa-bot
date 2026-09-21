import { Schema } from 'effect';

// One delivered job (a `seen_jobs` row): what the Jobs tab lists. Title/company/
// location come from the delivery snapshot (null for legacy rows without one).
// matchScore/matchReason are the personal CV match (DM scope only, null
// otherwise); aiSummary is the shared cached summary from `jobs`.
export const JobDto = Schema.Struct({
  id: Schema.Number,
  subscriptionId: Schema.Number,
  source: Schema.String,
  externalId: Schema.String,
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  company: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  firstSeenAt: Schema.String, // ISO 8601
  matchScore: Schema.NullOr(Schema.Number),
  matchReason: Schema.NullOr(Schema.String),
  aiSummary: Schema.NullOr(Schema.String),
});
export type JobDto = typeof JobDto.Type;

export const JobsResponse = Schema.Struct({
  jobs: Schema.Array(JobDto),
  page: Schema.Number,
  pageSize: Schema.Number,
  total: Schema.Number,
});
export type JobsResponse = typeof JobsResponse.Type;
