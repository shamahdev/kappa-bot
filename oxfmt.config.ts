import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...ultracite.ignorePatterns,
    "**/.tanstack",
    "**/.nitro",
    "drizzle/meta/**",
    "**/themes/built/**",
  ],
});
