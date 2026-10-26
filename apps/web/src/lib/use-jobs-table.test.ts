import { describe, expect, test } from "bun:test";

import { ALL_SOURCES, jobsParams } from "./use-jobs-table";
import type { JobsFilters } from "./use-jobs-table";

const filters: JobsFilters = {
  q: "",
  source: ALL_SOURCES,
  subscriptionId: null,
};

describe("jobs query coordination", () => {
  test("all-subscription/source choices omit those filters and preserve DM scope", () => {
    expect(jobsParams({ scope: "dm" }, filters, 1)).toEqual({
      scope: "dm",
      q: undefined,
      source: undefined,
      subscription: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  test("queries a numeric subscription id without looking up mutable labels", () => {
    const params = jobsParams(
      { guild: "server" },
      { ...filters, subscriptionId: 7 },
      2
    );
    expect(params.subscription).toBe(7);
    expect(params.guild).toBe("server");
  });

  test("search, source and paging are coordinated without altering the selected id", () => {
    expect(
      jobsParams(
        { scope: "dm" },
        {
          q: "  engineer  ",
          source: "linkedin",
          subscriptionId: 7,
        },
        3
      )
    ).toEqual({
      scope: "dm",
      q: "engineer",
      source: "linkedin",
      subscription: 7,
      page: 3,
      pageSize: 20,
    });
  });

  test("whitespace-only search is omitted", () => {
    expect(
      jobsParams({ scope: "dm" }, { ...filters, q: "  " }, 1).q
    ).toBeUndefined();
  });
});
