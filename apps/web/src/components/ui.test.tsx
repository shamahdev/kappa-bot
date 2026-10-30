import { describe, expect, test } from "bun:test";

import { renderToString } from "react-dom/server";

import { DiscordLogin, Modal, StatusDot, Tabs } from "./ui";

describe("shared UI semantics", () => {
  test("Discord authentication actions include the official symbol and destination", () => {
    const html = renderToString(<DiscordLogin label="Reconnect Discord" />);
    expect(html).toContain("discord-login");
    expect(html).toContain("Reconnect Discord");
    expect(html).toContain("/api/v1/auth/discord/login?return_to=%2Fdashboard");
    expect(html).toContain('alt=""');
    expect(html).toContain("discord-symbol-white.svg");
  });
  test("dialogs keep Close unless the form already supplies Cancel", () => {
    const summary = renderToString(
      <Modal onClose={() => {}} open title="Job summary">
        Summary text
      </Modal>
    );
    expect(summary).toContain('aria-label="Close dialog"');
    const form = renderToString(
      <Modal
        onClose={() => {}}
        open
        showCloseButton={false}
        title="Edit subscription"
      >
        <button type="button">Cancel</button>
      </Modal>
    );
    expect(form).toContain(">Cancel<");
    expect(form).not.toContain('aria-label="Close dialog"');
  });

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
