import { describe, expect, test } from "bun:test";

import {
  CV_REPORT_FIT_MAX_WORDS,
  CV_REPORT_ITEM_MAX_WORDS,
  CV_REPORT_MAX_ATTEMPTS,
  CV_REPORT_PERIOD_MS,
  clampCvReportSummary,
  clampWords,
  cvSnapshotChanged,
  safeHttpUrl,
} from "@kappa/contracts";
import type { MatchBreakdownType } from "@kappa/contracts";
import { createMemoryGenerationLock } from "@kappa/db";
import type { cvReports } from "@kappa/db";

import type { Logger } from "../../../core/logger";
import type { JobPosting } from "../domain/posting";
import {
  jsonObjectCandidates,
  parseCvReportSummary,
  parseMatchJson,
} from "../infrastructure/ai";
import { createCvReportQueries, reportListDtos } from "./cv-report-queries";
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
  notificationClaimedAt: null,
  notifiedAt: null,
  score,
  source: null,
  status,
  subscriptionId: null,
  summary: null,
  summaryAttempts: 0,
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
  grade: string | null = null,
  attempts = 0
) => ({
  assessment,
  attempts,
  factors: assessment === "scored" ? factors(80, 80, 80) : null,
  failureReason: null,
  grade,
  id,
  posting: posting(String(id)),
  reportId: 7,
});

describe("model reply parsing", () => {
  const answer = JSON.stringify(factors(80, 60, 40));

  test("ignores a  think block that contains draft braces", () => {
    const raw = ` thinkDraft: {"skills": {"score": 10}} hmm</think>\n${answer}`;
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
    const [latest, pending, older, oldest] = reportListDtos([
      row(4, "ready", 70),
      row(3, "pending", null),
      row(2, "ready", 55),
      row(1, "ready", 40),
    ]);
    expect(latest?.previous).toMatchObject({ id: 2, score: 55 });
    expect(pending?.previous?.id).toBe(2);
    expect(older?.previous?.id).toBe(1);
    expect(oldest?.previous).toBe(null);
    expect(latest?.jobCount).toBe(0);
  });

  test("legacy ready rows without a stored score derive it from factors", () => {
    const [legacy] = reportListDtos([{ ...row(1, "ready", 60), score: null }]);
    expect(legacy?.score).toBe(60);
  });

  test("deltas are marked when the CV snapshot changed", () => {
    const previous = {
      cvUploadedAt: "2026-10-01T00:00:00.000Z",
      factors: null,
      grade: "C" as const,
      id: 1,
      score: 50,
    };
    expect(
      cvSnapshotChanged({
        cvUploadedAt: "2026-10-01T00:00:00.000Z",
        previous,
      })
    ).toBe(false);
    expect(
      cvSnapshotChanged({
        cvUploadedAt: "2026-10-02T00:00:00.000Z",
        previous,
      })
    ).toBe(true);
  });
});

describe("report detail tracking handles", () => {
  test("marks only seen jobs that still exist as trackable", async () => {
    const report = {
      ...row(7, "ready", 70),
      jobs: [
        {
          assessment: "scored" as const,
          company: "Co",
          grade: "B" as const,
          seenJobId: 11,
          source: "test",
          title: "Role 1",
          url: "https://example.com/1",
        },
        {
          assessment: "scored" as const,
          company: "Co",
          grade: "C" as const,
          seenJobId: 12,
          source: "test",
          title: "Role 2",
          url: "https://example.com/2",
        },
      ],
    };
    const fake = testDatabase([[report], [], [{ id: 11 }]]);
    const dto = await createCvReportQueries(fake.db).get("u", 7);
    expect(dto?.jobs.map((job) => job.trackable)).toEqual([true, false]);
  });
});

describe("external URL safety", () => {
  test("only absolute http(s) URLs are clickable", () => {
    expect(safeHttpUrl("https://example.com/job/1")).toBe(
      "https://example.com/job/1"
    );
    expect(safeHttpUrl("http://example.com/job/1")).toBe(
      "http://example.com/job/1"
    );
    // oxlint-disable-next-line no-script-url
    expect(safeHttpUrl("javascript:alert(1)")).toBe(null);
    expect(safeHttpUrl("/relative")).toBe(null);
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
    summaryAttempts: 0,
    userId: "u",
  };
  const log = { info() {}, warn() {} } as unknown as Logger;
  const run = async (
    reads: unknown[][],
    outcomes: Record<string, ReportAssessment>,
    returned: unknown[] = [{ id: 7 }]
  ) => {
    const fake = testDatabase(reads, returned);
    const assessed: string[] = [];
    const enrichment = {
      assessForReport: (job: JobPosting) => {
        assessed.push(job.id);
        return Promise.resolve(
          outcomes[job.id] ?? {
            kind: "failed",
            reason: "not scripted",
            transient: true,
          }
        );
      },
    } as unknown as ReturnType<typeof createJobEnrichment>;
    await createCvReports({ db: fake.db, enrichment, log }).generate(7);
    return { assessed, fake };
  };

  test("persists each finished job, never re-assesses it, and keeps the report pending on a transient failure", async () => {
    const rows = [
      delivery(1, "scored", "A"),
      delivery(2, null),
      delivery(3, null),
    ];
    const { assessed, fake } = await run([[reportRow], [cvRow], rows, rows], {
      "2": { kind: "failed", reason: "timeout", transient: true },
      "3": { kind: "skipped", reason: "no description" },
    });
    expect(assessed).toEqual(["2", "3"]);
    expect(fake.writes).toContainEqual(
      expect.objectContaining({
        operation: "update",
        table: "cv_report_deliveries",
        values: expect.objectContaining({ assessment: "skipped" }),
      })
    );
    const updates = reportUpdates(fake);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.values).toEqual({
      message: "Scored 1 of 3 jobs. 1 will be retried automatically.",
    });
    // No AI call ran inside a transaction.
    expect(fake.transactionCount).toBe(0);
  });

  test("a transient failure becomes terminal at the attempt cap and the report publishes without that job", async () => {
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const rows = [
        delivery(1, "scored", "A"),
        delivery(2, null, null, CV_REPORT_MAX_ATTEMPTS - 1),
      ];
      const { fake } = await run([[reportRow], [cvRow], rows, rows], {
        "2": { kind: "failed", reason: "timeout", transient: true },
      });
      const updates = reportUpdates(fake);
      expect(updates.at(-1)?.values).toMatchObject({
        message:
          "1 job could not be assessed. Scores are ready; the written summary could not be generated.",
        status: "ready",
        summary: null,
      });
      expect(updates.at(-1)?.values).toMatchObject({
        jobs: expect.arrayContaining([
          expect.objectContaining({ assessment: "failed", grade: null }),
        ]),
      });
    } finally {
      if (saved !== undefined) {
        process.env.GROQ_API_KEY = saved;
      }
    }
  });

  test("a permanent assessment failure is terminal immediately", async () => {
    const rows = [delivery(1, null)];
    const { fake } = await run([[reportRow], [cvRow], rows, rows], {
      "1": { kind: "failed", reason: "provider 400", transient: false },
    });
    expect(reportUpdates(fake).at(-1)?.values).toMatchObject({
      message: "None of the 1 jobs could be assessed.",
      status: "unavailable",
    });
  });

  test("a failed summary publishes scores instead of blocking the report", async () => {
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const rows = [delivery(1, "scored", "A")];
      const { fake } = await run([[reportRow], [cvRow], rows, rows], {});
      const updates = reportUpdates(fake);
      expect(updates.at(-1)?.values).toMatchObject({
        message:
          "Scores are ready; the written summary could not be generated.",
        status: "ready",
        summary: null,
      });
    } finally {
      if (saved !== undefined) {
        process.env.GROQ_API_KEY = saved;
      }
    }
  });

  test("a period with only description-less jobs is unavailable, not stuck", async () => {
    const rows = [delivery(1, null)];
    const { fake } = await run([[reportRow], [cvRow], rows, rows], {
      "1": { kind: "skipped", reason: "no description" },
    });
    expect(reportUpdates(fake).at(-1)?.values).toMatchObject({
      message: "None of the 1 jobs had a description to assess.",
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

  test("generation skips when another process holds the report lock", async () => {
    const lock = createMemoryGenerationLock();
    const release = await lock.acquire("cv-report:7");
    expect(release).not.toBeNull();
    const fake = testDatabase();
    const reports = createCvReports({
      db: fake.db,
      enrichment: {} as ReturnType<typeof createJobEnrichment>,
      lock,
      log,
    });
    await reports.generate(7);
    expect(fake.readCount).toBe(0);
    await release?.();
  });

  test("claims and sends a ready report notification", async () => {
    const fake = testDatabase(
      [[], [{ id: 7, status: "ready" }]],
      [{ grade: "B", userId: "u" }]
    );
    const notified: unknown[][] = [];
    const reports = createCvReports({
      db: fake.db,
      enrichment: {} as ReturnType<typeof createJobEnrichment>,
      log,
      notify: (userId, reportId, grade) => {
        notified.push([userId, reportId, grade]);
        return Promise.resolve();
      },
    });
    await reports.processPending(new Date());
    expect(notified).toEqual([["u", 7, "B"]]);
    expect(fake.writes).toContainEqual(
      expect.objectContaining({
        table: "cv_reports",
        values: expect.objectContaining({
          notificationClaimedAt: expect.any(Date),
        }),
      })
    );
  });

  test("releases a failed notification claim for retry", async () => {
    const fake = testDatabase(
      [[], [{ id: 7, status: "ready" }]],
      [{ grade: "B", userId: "u" }]
    );
    const reports = createCvReports({
      db: fake.db,
      enrichment: {} as ReturnType<typeof createJobEnrichment>,
      log,
      notify: () => Promise.reject(new Error("DM closed")),
    });
    await reports.processPending(new Date());
    expect(fake.writes).toContainEqual(
      expect.objectContaining({
        table: "cv_reports",
        values: { notificationClaimedAt: null },
      })
    );
  });
});

describe("report retry", () => {
  const cvRow = {
    discordId: "u",
    filename: "cv.pdf",
    text: "cv text",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  };
  const log = { info() {}, warn() {} } as unknown as Logger;
  const enrichment = {} as ReturnType<typeof createJobEnrichment>;

  test("requeues a cv_required report and resets its deliveries", async () => {
    const fake = testDatabase(
      [[{ id: 7, status: "cv_required" }], [cvRow]],
      [{ id: 7 }]
    );
    const result = await createCvReports({
      db: fake.db,
      enrichment,
      log,
    }).retry("u", 7);
    expect(result).toBe("queued");
    expect(reportUpdates(fake)).toContainEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          factors: null,
          status: "pending",
          summary: null,
        }),
      })
    );
    expect(fake.writes).toContainEqual(
      expect.objectContaining({
        operation: "update",
        table: "cv_report_deliveries",
        values: expect.objectContaining({ assessment: null, attempts: 0 }),
      })
    );
  });

  test("refuses to requeue without a CV or when the report is not retryable", async () => {
    const noCv = testDatabase([[{ id: 7, status: "cv_required" }], []]);
    expect(
      await createCvReports({ db: noCv.db, enrichment, log }).retry("u", 7)
    ).toBe("cv_required");
    const ready = testDatabase([[{ id: 7, status: "ready" }]]);
    expect(
      await createCvReports({ db: ready.db, enrichment, log }).retry("u", 7)
    ).toBe("not_retryable");
    const missing = testDatabase([[]]);
    expect(
      await createCvReports({ db: missing.db, enrichment, log }).retry("u", 7)
    ).toBe("not_found");
  });
});
