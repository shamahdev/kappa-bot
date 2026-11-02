// Real-DOM tests for portal-based shadcn components. Run in their own process
// with test/dom-setup.ts preloaded (see the root "test:dom" script).
import { afterEach, describe, expect, mock, test } from "bun:test";

import type { ApplicationDtoType } from "@kappa/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

const ignoreClose = () => null;
let root: Root | undefined;
const mount = async (node: ReactNode) => {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root?.render(
      <QueryClientProvider client={new QueryClient()}>
        {node}
      </QueryClientProvider>
    );
  });
};
afterEach(async () => {
  await act(() => root?.unmount());
  document.body.innerHTML = "";
});

const settle = () => act(() => Bun.sleep(30));
const clickButton = (text: string) =>
  [...document.querySelectorAll("button")]
    .find((button) => button.textContent === text)
    ?.click();
const press = async (element: Element, key: string) => {
  await act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
};
const labels = (role: string) =>
  [...document.querySelectorAll(`[role="${role}"]`)].map((item) =>
    item.textContent?.trim()
  );

describe("shadcn Dialog (Modal)", () => {
  test("keeps Close unless the form already supplies Cancel", async () => {
    const { Modal } = await import("./ui");
    await mount(
      <Modal onClose={ignoreClose} open title="Job summary">
        Summary text
      </Modal>
    );
    expect(document.querySelector('[aria-label="Close dialog"]')).not.toBe(
      null
    );
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Summary text"
    );
    await act(() => root?.unmount());
    document.body.innerHTML = "";
    await mount(
      <Modal onClose={ignoreClose} open showCloseButton={false} title="Edit">
        <button type="button">Cancel</button>
      </Modal>
    );
    expect(document.querySelector('[aria-label="Close dialog"]')).toBe(null);
  });
});

describe("TrackControl (shadcn DropdownMenu, no native select)", () => {
  test("untracked jobs offer only Bookmark and Applied", async () => {
    const { TrackControl } = await import("./track-control");
    await mount(<TrackControl seenJobId={1} status={null} title="Engineer" />);
    expect(document.querySelector("select")).toBe(null);
    const trigger = document.querySelector("button");
    expect(trigger?.getAttribute("aria-label")).toBe(
      "Tracking status for Engineer: Track job"
    );
    await press(trigger as Element, "Enter");
    expect(labels("menuitemradio")).toEqual(["Bookmark", "Applied"]);
  });

  test("tracked jobs list every status with the current one checked", async () => {
    const { TrackControl } = await import("./track-control");
    await mount(<TrackControl seenJobId={1} status="offer" title="Engineer" />);
    await press(document.querySelector("button") as Element, "Enter");
    expect(labels("menuitemradio")).toEqual([
      "Bookmark",
      "Applied",
      "Interview",
      "Offer",
      "Rejected",
      "Archive",
    ]);
    expect(
      document
        .querySelector('[role="menuitemradio"][aria-checked="true"]')
        ?.textContent?.trim()
    ).toBe("Offer");
  });
});

describe("Archiving on the board", () => {
  test("shows a toast whose Undo restores the previous status", async () => {
    const card: ApplicationDtoType = {
      company: "Co",
      createdAt: "2026-11-01T00:00:00.000Z",
      id: 7,
      location: null,
      matchGrade: "B",
      source: "linkedin",
      status: "interview",
      title: "Engineer",
      updatedAt: "2026-11-01T00:00:00.000Z",
      url: "https://example.com",
    };
    // Network-free: replace only the API call; the UI hook stays real.
    const moves: { id: number; status: string }[] = [];
    const api = await import("../lib/api");
    mock.module("../lib/api", () => ({
      ...api,
      moveApplication: (id: number, status: ApplicationDtoType["status"]) => {
        moves.push({ id, status });
        return Promise.resolve({ ...card, status });
      },
    }));
    const { useBoardMove } = await import("./application-board");
    const { Toaster } = await import("./shadcn/sonner");
    const Probe = () => {
      const { moveCard } = useBoardMove();
      return (
        <button onClick={() => moveCard(card, "archive")} type="button">
          Archive card
        </button>
      );
    };
    await mount(
      <>
        <Probe />
        <Toaster />
      </>
    );
    await act(() => clickButton("Archive card"));
    await settle();
    expect(document.body.textContent).toContain("Archived “Engineer”");
    const undo = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Undo"
    );
    expect(undo).toBeDefined();
    await act(() => undo?.click());
    await settle();
    expect(moves).toEqual([
      { id: 7, status: "archive" },
      { id: 7, status: "interview" },
    ]);
  });
});
