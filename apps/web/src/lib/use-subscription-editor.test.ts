import { describe, expect, test } from "bun:test";

import { parseSubscriptionDraft } from "./use-subscription-editor";
import type { SubscriptionDraft } from "./use-subscription-editor";

const draft: SubscriptionDraft = {
  keywords: "  engineer  ",
  location: "  Indonesia  ",
  retentionDays: "30",
};

describe("subscription editor draft", () => {
  test.each(["1", "30", "365", " 30 "])(
    "accepts an existing-contract whole day value: %s",
    (retentionDays) => {
      expect(parseSubscriptionDraft({ ...draft, retentionDays })).toEqual({
        ok: true,
        patch: {
          keywords: "engineer",
          location: "Indonesia",
          retentionDays: Number(retentionDays),
        },
      });
    }
  );

  test.each([
    "1.9",
    "30days",
    "abc",
    "",
    " ",
    "0",
    "-1",
    "366",
    "1e2",
    "0x10",
    "NaN",
    "Infinity",
  ])(
    "rejects the entire invalid draft, rather than truncating or omitting %s",
    (retentionDays) => {
      expect(parseSubscriptionDraft({ ...draft, retentionDays })).toEqual({
        ok: false,
        errors: { retentionDays: "Enter a whole number from 1 to 365." },
      });
    }
  );

  test("reports field errors together and does not produce a mutation patch", () => {
    expect(
      parseSubscriptionDraft({
        keywords: " ",
        location: "",
        retentionDays: "abc",
      })
    ).toEqual({
      ok: false,
      errors: {
        keywords: "Keywords must not be blank.",
        location: "Location must not be blank.",
        retentionDays: "Enter a whole number from 1 to 365.",
      },
    });
  });
});
