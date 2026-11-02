import { describe, expect, test } from "bun:test";

import { renderToString } from "react-dom/server";

import { GradeChip } from "./score";

describe("GradeChip", () => {
  test("announces the grade once", () => {
    const html = renderToString(<GradeChip grade="B" />);
    expect(html.match(/Good match/gu)).toHaveLength(1);
  });
});
