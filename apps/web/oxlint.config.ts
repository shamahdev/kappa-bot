import { defineConfig } from "oxlint";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";

import root from "../../oxlint.config.ts";

export default defineConfig({
  extends: [root, react, tanstack],
  ignorePatterns: root.ignorePatterns,
});
