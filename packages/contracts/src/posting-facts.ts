import { Schema } from "effect";

export const WORK_ENVIRONMENTS = ["onsite", "remote", "hybrid"] as const;
export const WorkEnvironment = Schema.Literal(...WORK_ENVIRONMENTS);
export type WorkEnvironmentType = typeof WorkEnvironment.Type;

export const PostingSalary = Schema.Struct({
  currency: Schema.NullOr(Schema.String),
  evidence: Schema.NullOr(Schema.String),
  max: Schema.NullOr(Schema.Number.pipe(Schema.finite(), Schema.nonNegative())),
  min: Schema.NullOr(Schema.Number.pipe(Schema.finite(), Schema.nonNegative())),
  period: Schema.NullOr(Schema.Literal("month", "year", "day", "hour")),
});
export type PostingSalaryType = typeof PostingSalary.Type;

export const PostingFacts = Schema.Struct({
  closed: Schema.optional(Schema.Boolean),
  salary: Schema.NullOr(PostingSalary),
  workEnvironment: Schema.NullOr(WorkEnvironment),
  workEnvironmentEvidence: Schema.NullOr(Schema.String),
});
export type PostingFactsType = typeof PostingFacts.Type;
export const decodePostingFacts = Schema.decodeUnknownSync(PostingFacts);
