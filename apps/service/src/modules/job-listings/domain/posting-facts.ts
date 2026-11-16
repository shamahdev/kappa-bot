import type { PostingFactsType, PostingSalaryType } from "@kappa/contracts";

import type { JobSubscription } from "./subscription";

export type SalaryDecision = "pass" | "fail" | "unknown";

export const salaryDecision = (
  salary: PostingSalaryType | null,
  minimum: number
): SalaryDecision => {
  if (!salary?.currency) {
    return "unknown";
  }
  if (salary.currency.toUpperCase() !== "IDR") {
    return "fail";
  }
  if (salary.period !== "month" && salary.period !== "year") {
    return "unknown";
  }
  const divisor = salary.period === "year" ? 12 : 1;
  if (salary.max !== null) {
    return salary.max / divisor >= minimum ? "pass" : "fail";
  }
  if (salary.min !== null && salary.min / divisor >= minimum) {
    return "pass";
  }
  return "unknown";
};

export const matchesPostingFacts = (
  sub: JobSubscription,
  facts: PostingFactsType
): boolean => {
  if (facts.closed) {
    return false;
  }
  if (sub.workEnvironments?.length) {
    if (facts.workEnvironment === null) {
      if (!sub.includeUnspecifiedEnvironment) {
        return false;
      }
    } else if (!sub.workEnvironments.includes(facts.workEnvironment)) {
      return false;
    }
  }
  if (sub.minimumSalary !== null && sub.minimumSalary !== undefined) {
    const decision = salaryDecision(facts.salary, sub.minimumSalary);
    if (
      decision === "fail" ||
      (decision === "unknown" && !sub.includeUnspecifiedSalary)
    ) {
      return false;
    }
  }
  return true;
};
