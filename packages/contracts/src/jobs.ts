import { Schema } from 'effect';

// One delivered job (a `seen_jobs` row): what the Jobs tab lists. Title/company/
// location come from the delivery snapshot (null for legacy rows without one).
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
});
export type JobDto = typeof JobDto.Type;

export const JobsResponse = Schema.Struct({
  jobs: Schema.Array(JobDto),
  page: Schema.Number,
  pageSize: Schema.Number,
  total: Schema.Number,
});
export type JobsResponse = typeof JobsResponse.Type;
