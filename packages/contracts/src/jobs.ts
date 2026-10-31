import { Schema } from "effect";

import { MatchBreakdown, MatchGrade } from "./matching";

// One delivered job. Percentage history is kept internally for compatibility;
// public presentation uses an A–E grade and the factor breakdown when available.
export const JobDto = Schema.Struct({
  aiSummary: Schema.NullOr(Schema.String),
  company: Schema.NullOr(Schema.String),
  externalId: Schema.String,
  // ISO 8601
  firstSeenAt: Schema.String,
  id: Schema.Number,
  location: Schema.NullOr(Schema.String),
  matchBreakdown: Schema.NullOr(MatchBreakdown),
  matchGrade: Schema.NullOr(MatchGrade),
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
