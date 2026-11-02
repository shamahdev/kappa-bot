import { describe, expect, test } from "bun:test";

import {
  CV_REPORT_FIT_MAX_WORDS,
  CV_REPORT_ITEM_MAX_WORDS,
  CV_REPORT_PERIOD_MS,
  clampCvReportSummary,
  clampWords,
} from "@kappa/contracts";
import type { MatchBreakdownType } from "@kappa/contracts";
import type { cvReports } from "@kappa/db";

import type { Logger } from "../../../core/logger";
import type { JobPosting } from "../domain/posting";
import {
  jsonObjectCandidates,
  parseCvReportSummary,
  parseMatchJson,
} from "../infrastructure/ai";
import { reportDtos } from "./cv-report-queries";
import {
  averageMatchFactors,
  createCvReports,
  isReportDue,
} from "./cv-reports";
import type { createJobEnrichment, ReportAssessment } from "./enrichment";
import { testDatabase } from "./test-database";

const factors = (
  skills: number,
  relevantExperience: number,
  keywordMatch: number
): MatchBreakdownType => ({
  keywordMatch: { reason: "Terms.", score: keywordMatch },
  relevantExperience: { reason: "Work.", score: relevantExperience },
  skills: { reason: "Skills.", score: skills },
});
const words = (count: number) =>
  Array.from({ length: count }, (_, index) => `w${index}`).join(" ");

const count = (text: string) => text.split(/\s+/u).length;
const row = (
  id: number,
  status: string,
  score: number | null
): typeof cvReports.$inferSelect => ({
  createdAt: new Date(2026, 9, id),
  cvFilename: null,
  cvUploadedAt: null,
  factors: score === null ? null : factors(score, score, score),
  grade: score === null ? null : "C",
  id,
  jobs: [],
  keywords: null,
  message: null,
  notifiedAt: null,
  score,
  source: null,
  status,
  subscriptionId: null,
  summary: null,
  trigger: "scheduled",
  userId: "u",
  windowEnd: new Date(2026, 9, id),
  windowStart: new Date(2026, 9, id - 3),
});
const posting = (id: string) => ({
  company: "Co",
  id,
  position: `Role ${id}`,
  source: "test",
  url: `https://example.com/${id}`,
});
const reportUpdates = (fake: ReturnType<typeof testDatabase>) =>
  fake.writes.filter(
    (write) => write.table === "cv_reports" && write.operation === "update"
  );

const delivery = (
  id: number,
  assessment: string | null,
  grade: string | null = null
) => ({
  assessment,
  factors: assessment === "scored" ? factors(80, 80, 80) : null,
  grade,
  id,
  posting: posting(String(id)),
  reportId: 7,
});

describe("model reply parsing", () => {
  const answer = JSON.stringify(factors(80, 60, 40));

  test("ignores a <think> block that contains draft braces", () => {
    const raw = `<think>Draft: {"skills": {"score": 10}} hmm</think>\n${answer}`;
    expect(parseMatchJson(raw)?.factors.skills.score).toBe(80);
  });

  test("picks the last valid object when prose surrounds several", () => {
    const raw = `Example {"a": 1}. Final answer:\n${answer}\nDone {not json}`;
    expect(parseMatchJson(raw)?.factors.relevantExperience.score).toBe(60);
  });

  test("braces inside strings do not break object boundaries", () => {
    expect(jsonObjectCandidates('{"reason": "uses {braces}"}')).toEqual([
      { reason: "uses {braces}" },
    ]);
  });

  test("weights and grades deterministically; rejects incomplete factors", () => {
    // 80*.5 + 60*.35 + 40*.15 = 67 → B
    expect(parseMatchJson(answer)).toMatchObject({ grade: "B", score: 67 });
    expect(parseMatchJson('{"skills": {"score": 50, "reason": "x"}}')).toBe(
      null
    );
  });
});

describe("summary word caps", () => {
  test("clampWords keeps at most the cap and marks the cut", () => {
    expect(clampWords("one two three", 3)).toBe("one two three");
    expect(clampWords("one two, three four", 2)).toBe("one two…");
  });

  test("every section obeys the requester's caps", () => {
    const clamped = clampCvReportSummary({
      candidateFit: words(CV_REPORT_FIT_MAX_WORDS + 25),
      commonGaps: [words(CV_REPORT_ITEM_MAX_WORDS + 5)],
      employerRequirements: [words(3), "  "],
      suitableRoles: [words(CV_REPORT_ITEM_MAX_WORDS)],
    });
    expect(count(clamped.candidateFit)).toBe(CV_REPORT_FIT_MAX_WORDS);
    expect(count(clamped.commonGaps[0] ?? "")).toBe(CV_REPORT_ITEM_MAX_WORDS);
    expect(clamped.employerRequirements).toEqual([words(3)]);
    expect(clamped.suitableRoles[0]).toBe(words(CV_REPORT_ITEM_MAX_WORDS));
  });

  test("parsed model summaries are clamped", () => {
    const summary = parseCvReportSummary(
      JSON.stringify({
        candidateFit: words(200),
        commonGaps: [],
        employerRequirements: [],
        suitableRoles: [],
      })
    );
    expect(summary?.candidateFit.split(" ")).toHaveLength(
      CV_REPORT_FIT_MAX_WORDS
    );
  });
});

describe("report aggregation and windows", () => {
  test("averages each factor over any number of scored jobs", () => {
    const average = averageMatchFactors([
      factors(100, 50, 0),
      factors(50, 50, 100),
    ]);
    expect(average.skills.score).toBe(75);
    expect(average.relevantExperience.score).toBe(50);
    expect(average.keywordMatch.score).toBe(50);
    expect(() => averageMatchFactors([])).toThrow();
  });

  test("a scheduled report is due exactly 3 days after the window opens", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    expect(
      isReportDue(start, new Date(start.getTime() + CV_REPORT_PERIOD_MS - 1))
    ).toBe(false);
    expect(
      isReportDue(start, new Date(start.getTime() + CV_REPORT_PERIOD_MS))
    ).toBe(true);
  });
});

describe("report history comparison", () => {
  test("each report compares with the closest older ready report", () => {
    const [latest, pending, older, oldest] = reportDtos([
      row(4, "ready", 70),
      row(3, "pending", null),
      row(2, "ready", 55),
      row(1, "ready", 40),
    ]);
    expect(latest?.previous).toMatchObject({ id: 2, score: 55 });
    expect(pending?.previous?.id).toBe(2);
    expect(older?.previous?.id).toBe(1);
    expect(oldest?.previous).toBe(null);
  });

  test("legacy ready rows without a stored score derive it from factors", () => {
    const [legacy] = reportDtos([{ ...row(1, "ready", 60), score: null }]);
    expect(legacy?.score).toBe(60);
  });
});

describe("report generation orchestration", () => {
  const cvUpdatedAt = new Date("2026-10-01T00:00:00Z");
  const cvRow = {
    discordId: "u",
    filename: "cv.pdf",
    text: "cv text",
    updatedAt: cvUpdatedAt,
  };
  const reportRow = {
    cvUploadedAt: cvUpdatedAt,
    id: 7,
    status: "pending",
    userId: "u",
  };
  const log = { info() {}, warn() {} } as unknown as Logger;
  const run = async (
    reads: unknown[][],
    outcomes: Record<string, ReportAssessment>
  ) => {
    const fake = testDatabase(reads, []);
    const assessed: string[] = [];
    const enrichment = {
      assessForReport: (job: JobPosting) => {
        assessed.push(job.id);
        return Promise.resolve(outcomes[job.id] ?? { kind: "failed" });
      },
    } as unknown as ReturnType<typeof createJobEnrichment>;
    await createCvReports({ db: fake.db, enrichment, log }).generate(7);
    return { assessed, fake };
  };

  test("persists each finished job, never re-assesses it, and keeps the report pending on a transient failure", async () => {
    const { assessed, fake } = await run(
      [
        [reportRow],
        [cvRow],
        [delivery(1, "scored", "A"), delivery(2, null), delivery(3, null)],
      ],
      { "2": { kind: "failed" }, "3": { kind: "skipped" } }
    );
    expect(assessed).toEqual(["2", "3"]);
    expect(fake.writes).toContainEqual(
      expect.objectContaining({
        operation: "update",
        table: "cv_report_deliveries",
        values: { assessment: "skipped" },
      })
    );
    const updates = reportUpdates(fake);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.values).toEqual({
      message: "Assessed 2 of 3 jobs. The rest will be retried automatically.",
    });
    // No AI call ran inside a transaction.
    expect(fake.transactionCount).toBe(0);
  });

  test("a failed summary keeps scores and leaves the report pending for retry", async () => {
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const { fake } = await run(
        [[reportRow], [cvRow], [delivery(1, "scored", "A")]],
        {}
      );
      const updates = reportUpdates(fake);
      expect(updates).toHaveLength(1);
      expect(updates[0]?.values).toEqual({
        message:
          "All jobs are scored. The written summary will be retried automatically.",
      });
    } finally {
      if (saved !== undefined) {
        process.env.GROQ_API_KEY = saved;
      }
    }
  });

  test("a period with only description-less jobs is unavailable, not stuck", async () => {
    const { fake } = await run(
      [[reportRow], [cvRow], [delivery(1, "skipped")]],
      {}
    );
    expect(reportUpdates(fake)[0]?.values).toMatchObject({
      status: "unavailable",
    });
  });

  test("no CV at generation marks the report cv_required", async () => {
    const { assessed, fake } = await run([[reportRow], []], {});
    expect(assessed).toEqual([]);
    expect(reportUpdates(fake)[0]?.values).toMatchObject({
      status: "cv_required",
    });
  });
});
