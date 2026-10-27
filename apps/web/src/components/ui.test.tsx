import { describe, expect, test } from "bun:test";

import { renderToString } from "react-dom/server";

import { StatusDot, Tabs } from "./ui";

describe("shared UI semantics", () => {
  test("status includes visible text, not only an accessible dot label", () => {
    expect(renderToString(<StatusDot label="Paused" on={false} />)).toContain(
      ">Paused<"
    );
  });

  test("local view tabs expose associated panels and omit inactive content", () => {
    const html = renderToString(
      <Tabs
        onChange={() => {}}
        tabs={[
          {
            value: "jobs",
            label: "Jobs",
            content: <span>Delivered rows</span>,
          },
          {
            value: "manage",
            label: "Manage",
            content: <span>Editor controls</span>,
          },
        ]}
        value="jobs"
      />
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain("aria-controls=");
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Delivered rows");
    expect(html).not.toContain("Editor controls");
  });
});
