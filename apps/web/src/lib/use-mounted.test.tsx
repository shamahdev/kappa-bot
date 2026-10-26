import { describe, expect, test } from "bun:test";

import { renderToString } from "react-dom/server";

import { useMounted } from "./use-mounted";

const HydrationGate = () => {
  const mounted = useMounted();
  return <span>{mounted ? "client" : "server"}</span>;
};

describe("hydration gate", () => {
  test("keeps server markup on the server snapshot", () => {
    expect(renderToString(<HydrationGate />)).toBe("<span>server</span>");
  });
});
