import { Schema } from "effect";

// Matching is an advisory product rubric, not a probability of being hired.
export const MATCH_FACTORS = [
  { key: "skills", label: "Skills", weight: 50 },
  { key: "relevantExperience", label: "Relevant experience", weight: 35 },
  { key: "keywordMatch", label: "Keyword match", weight: 15 },
] as const;

export const MatchGrade = Schema.Literal("A", "B", "C", "D", "E");
export type MatchGradeType = typeof MatchGrade.Type;
export const MATCH_GRADE_LABELS: Record<MatchGradeType, string> = {
  A: "Strong match",
  B: "Good match",
  C: "Partial match",
  D: "Limited match",
  E: "Weak match",
};

// Five equal-width bands span the 0–100 factor rubric. These are a product
// convention, not empirically calibrated selection cutoffs.
export const matchGradeForScore = (score: number): MatchGradeType => {
  if (score >= 80) {
    return "A";
  }
  if (score >= 60) {
    return "B";
  }
  if (score >= 40) {
    return "C";
  }
  if (score >= 20) {
    return "D";
  }
  return "E";
};

const MatchFactor = Schema.Struct({
  reason: Schema.String.pipe(
    Schema.minLength(1),
    Schema.filter((value) => Boolean(value.trim()))
  ),
  score: Schema.Number.pipe(Schema.between(0, 100)),
});
export const MatchBreakdown = Schema.Struct({
  keywordMatch: MatchFactor,
  relevantExperience: MatchFactor,
  skills: MatchFactor,
});
export const decodeMatchBreakdown = Schema.decodeUnknownSync(MatchBreakdown);
export type MatchBreakdownType = typeof MatchBreakdown.Type;

export const JobMatch = Schema.Struct({
  factors: MatchBreakdown,
  grade: MatchGrade,
  reason: Schema.String,
  score: Schema.Number.pipe(Schema.between(0, 100)),
});
export type JobMatchType = typeof JobMatch.Type;

export const weightedMatchScore = (factors: MatchBreakdownType): number =>
  MATCH_FACTORS.reduce(
    (total, factor) =>
      total + (factors[factor.key].score * factor.weight) / 100,
    0
  );
