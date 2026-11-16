import { expect, test } from "bun:test";

import type { PostingSalaryType } from "@kappa/contracts";

import { matchesPostingFacts, salaryDecision } from "./posting-facts";
import {
  keywordAlternativesForSubscription,
  subscriptionPatch,
  subscriptionKeywords,
} from "./subscription";
import type { JobSubscription } from "./subscription";

const salary = (
  min: number | null,
  max: number | null,
  currency = "IDR",
  period: PostingSalaryType["period"] = "month"
): PostingSalaryType => ({ currency, evidence: "salary", max, min, period });

test("minimum salary means advertised pay can reach the threshold", () => {
  for (const value of [
    salary(1000, 2000),
    salary(800, 1200),
    salary(null, 1200),
    salary(1200, null),
  ]) {
    expect(salaryDecision(value, 1000)).toBe("pass");
  }
  expect(salaryDecision(salary(null, 800), 1000)).toBe("fail");
  expect(salaryDecision(salary(800, null), 1000)).toBe("unknown");
  expect(salaryDecision(salary(12_000, 24_000, "IDR", "year"), 1000)).toBe(
    "pass"
  );
  expect(salaryDecision(salary(1000, 2000, "USD"), 1000)).toBe("fail");
  expect(salaryDecision(salary(1000, 2000, "IDR", "hour"), 1000)).toBe(
    "unknown"
  );
});

test("unknown options never override known mismatches", () => {
  const sub = {
    includeUnspecifiedEnvironment: true,
    includeUnspecifiedSalary: true,
    minimumSalary: 1000,
    workEnvironments: ["remote"],
  } as JobSubscription;
  expect(
    matchesPostingFacts(sub, {
      salary: null,
      workEnvironment: null,
      workEnvironmentEvidence: null,
    })
  ).toBe(true);
  expect(
    matchesPostingFacts(sub, {
      salary: salary(null, 800),
      workEnvironment: null,
      workEnvironmentEvidence: null,
    })
  ).toBe(false);
  expect(
    matchesPostingFacts(sub, {
      salary: null,
      workEnvironment: "hybrid",
      workEnvironmentEvidence: "office twice a week",
    })
  ).toBe(false);
});

test("new keywords normalize alternatives; legacy text stays one search", () => {
  expect(subscriptionKeywords("frontend, NEXTJS, nextjs, , fullstack")).toBe(
    "frontend, NEXTJS, fullstack"
  );
  expect(
    keywordAlternativesForSubscription({
      keywords: "frontend, nextjs",
    } as JobSubscription)
  ).toEqual(["frontend, nextjs"]);
  expect(() => subscriptionKeywords(", ,")).toThrow();
  expect(() =>
    subscriptionKeywords(
      Array.from({ length: 11 }, (_, i) => `role${i}`).join(",")
    )
  ).toThrow();
  expect(() => subscriptionPatch({ minimumSalary: -1 })).toThrow();
  expect(
    subscriptionPatch({ minimumSalary: null, title: "  Web engineering  " })
  ).toEqual({ minimumSalary: null, title: "Web engineering" });
});
