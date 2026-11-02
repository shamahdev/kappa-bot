import { describe, expect, test } from "bun:test";

import { renderToString } from "react-dom/server";

import { Markdown } from "./markdown";
import { GradeBadge } from "./score";

describe("Markdown summaries", () => {
  test("renders bold, mixed bullets and paragraphs instead of raw syntax", () => {
    const html = renderToString(
      <Markdown
        text={
          "Backend role on the **payments** team.\n**Must-have:**\n• Go\n• PostgreSQL\nApply via the site."
        }
      />
    );
    expect(html).not.toContain("**");
    expect(html).not.toContain("•");
    expect(html).toContain("<strong>payments</strong>");
    expect(html).toContain("<li>Go</li><li>PostgreSQL</li>");
    expect(html.match(/<p>/gu)).toHaveLength(2);
  });

  test("never injects HTML from model text", () => {
    const html = renderToString(
      <Markdown text="<img src=x onerror=1> **ok**" />
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("GradeBadge", () => {
  test("uses the bold grade color class and an accessible label", () => {
    const html = renderToString(<GradeBadge grade="D" />);
    expect(html).toContain("score-d");
    expect(html).toContain("Grade D, Limited match");
  });
});
