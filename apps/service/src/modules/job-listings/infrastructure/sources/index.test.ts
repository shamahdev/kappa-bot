import { describe, expect, test } from "bun:test";

import { JOB_SOURCE_SELECTIONS } from "@kappa/contracts";

import type { FingerprintQuery, JobPosting } from "../../domain/posting";
import {
  fetchJobPostingDetail,
  pollSources,
  resolveSourceSelection,
  SUPPORTED_SOURCES,
  searchJobPostings,
  searchSelection,
} from "./index";

const query: FingerprintQuery = { filters: {}, keywords: "engineer" };
const posting = (source: string): JobPosting => ({
  agoTime: "today",
  company: "Example",
  datetime: null,
  id: "job-1",
  location: "Indonesia",
  logo: null,
  position: "Engineer",
  salary: null,
  source,
  url: "https://example.test/jobs/1",
});

describe("source selection", () => {
  test("uses the canonical selections and keeps always-on sources without cookies", () => {
    expect(SUPPORTED_SOURCES).toBe(JOB_SOURCE_SELECTIONS);
    expect(pollSources({})).toEqual(["linkedin", "kalibrr", "techinasia"]);
    expect(resolveSourceSelection("all", {})).toEqual(pollSources({}));
  });

  test("all includes only configured cookie opt-ins; direct opt-ins remain concrete", () => {
    const env = {
      GLINTS_COOKIES: " clearance=ok ",
      INDEED_COOKIES: "  ",
      JOBSTREET_COOKIES: "token=ok",
    };
    expect(resolveSourceSelection("all", env)).toEqual([
      "linkedin",
      "kalibrr",
      "techinasia",
      "glints",
      "jobstreet",
    ]);
    expect(resolveSourceSelection("indeed", {})).toEqual(["indeed"]);
  });

  test("all gathers successful sources and isolates a failed source", async () => {
    const calls: string[] = [];
    const failures: [string, unknown][] = [];
    const unavailable = new Error("provider unavailable");
    const jobs = await searchSelection("all", query, "listing-key", {
      env: { GLINTS_COOKIES: "clearance=ok" },
      onSourceError: (source, error) => failures.push([source, error]),
      search: (source, receivedQuery, key) => {
        calls.push(source);
        expect(receivedQuery).toBe(query);
        expect(key).toBe("listing-key");
        if (source === "kalibrr") {
          return Promise.reject(unavailable);
        }
        return Promise.resolve([posting(source)]);
      },
    });
    expect(calls).toEqual(["linkedin", "kalibrr", "techinasia", "glints"]);
    expect(jobs.map((job) => job.source)).toEqual([
      "linkedin",
      "techinasia",
      "glints",
    ]);
    expect(failures).toEqual([["kalibrr", unavailable]]);
  });

  test("direct known-source errors propagate instead of becoming empty listings", async () => {
    const unavailable = new Error("fresh cookies needed");
    await expect(
      searchSelection("indeed", query, "direct-key", {
        env: {},
        search: (source) => {
          expect(source).toBe("indeed");
          return Promise.reject(unavailable);
        },
      })
    ).rejects.toBe(unavailable);
  });

  test("unknown selections fail before even an injected search can run", async () => {
    let searched = false;
    expect(() => resolveSourceSelection("unknown", {})).toThrow(
      "Unknown concrete job source"
    );
    await expect(
      searchSelection("unknown", query, "unknown-key", {
        env: {},
        search: () => {
          searched = true;
          return Promise.resolve([]);
        },
      })
    ).rejects.toThrow("Unknown concrete job source");
    expect(searched).toBe(false);
  });

  test("concrete search and detail reject unknown identities and the all selection", async () => {
    for (const source of ["unknown", "all", "toString"]) {
      // Finish each invalid identity's search check before checking its detail path.
      // oxlint-disable-next-line no-await-in-loop
      await expect(
        searchJobPostings(source, query, "invalid-key")
      ).rejects.toThrow("Unknown concrete job source");
      // Preserve search/detail assertion order for each invalid identity.
      // oxlint-disable-next-line no-await-in-loop
      await expect(fetchJobPostingDetail(posting(source))).rejects.toThrow(
        "Unknown concrete job source"
      );
    }
  });
});
