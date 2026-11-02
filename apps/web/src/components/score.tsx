import { MATCH_GRADE_LABELS, matchGradeForScore } from "@kappa/contracts";
import type { MatchGradeType } from "@kappa/contracts";
import type { ReactNode } from "react";

import "./score.css";

const tone = (grade: MatchGradeType | null | undefined) =>
  grade ? `score-${grade.toLowerCase()}` : "score-none";

/** The one A–E score badge used everywhere a grade is shown. */
export const GradeBadge = ({
  grade,
  size = "md",
  placeholder = "–",
  decorative = false,
}: {
  grade: MatchGradeType | null | undefined;
  size?: "sm" | "md" | "lg";
  placeholder?: string;
  /** Set when adjacent visible text already names the grade. */
  decorative?: boolean;
}) => (
  <span
    aria-hidden={decorative || undefined}
    className={`score-grade size-${size} ${tone(grade)}`}
  >
    <span aria-hidden="true">{grade ?? placeholder}</span>
    {decorative ? null : (
      <span className="sr-only">
        {grade ? `Grade ${grade}, ${MATCH_GRADE_LABELS[grade]}` : "No grade"}
      </span>
    )}
  </span>
);

/** Badge plus its label, e.g. "[B] Good match". */
export const GradeChip = ({
  grade,
  size = "sm",
}: {
  grade: MatchGradeType | null | undefined;
  size?: "sm" | "md";
}) => (
  <span className="score-chip">
    <GradeBadge decorative grade={grade} size={size} />
    <span className="score-chip-label">
      {grade ? `${grade} · ${MATCH_GRADE_LABELS[grade]}` : "Not assessed"}
    </span>
  </span>
);

/** A 0–100 factor score, colored by the grade band it falls in. */
export const FactorScore = ({
  label,
  weight,
  score,
  reason,
  delta,
  large = false,
}: {
  label: string;
  weight: number;
  score: number;
  reason?: string;
  delta?: ReactNode;
  large?: boolean;
}) => {
  const value = Math.round(score);
  return (
    <div
      className={`factor-score ${tone(matchGradeForScore(value))} ${large ? "large" : ""}`}
    >
      <div className="factor-score-head">
        <span>{label}</span>
        <small>{weight}% weight</small>
      </div>
      <div className="factor-score-value">
        <strong>{value}</strong>
        <span>/100</span>
        {delta}
      </div>
      <div aria-hidden="true" className="factor-score-bar">
        <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {reason ? <p>{reason}</p> : null}
    </div>
  );
};
