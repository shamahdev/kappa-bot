import { Schema } from "effect";

// One delivered job (a `seen_jobs` row): what the Jobs tab lists. Title/company/
// location come from the delivery snapshot (null for legacy rows without one).
// matchScore/matchReason are the personal CV match (DM scope only, null
// otherwise); aiSummary is the shared cached summary from `jobs`.
export const JobDto = Schema.Struct({
  aiSummary: Schema.NullOr(Schema.String),
  company: Schema.NullOr(Schema.String),
  externalId: Schema.String,
  // ISO 8601
  firstSeenAt: Schema.String,
  id: Schema.Number,
  location: Schema.NullOr(Schema.String),
  matchReason: Schema.NullOr(Schema.String),
  matchScore: Schema.NullOr(Schema.Number),
  source: Schema.String,
  subscriptionId: Schema.Number,
  title: Schema.NullOr(Schema.String),
  url: Schema.String,
});
export type JobDtoType = typeof JobDto.Type;

export const JobsResponse = Schema.Struct({
  jobs: Schema.Array(JobDto),
  page: Schema.Number,
  pageSize: Schema.Number,
  total: Schema.Number,
});
export type JobsResponseType = typeof JobsResponse.Type;
