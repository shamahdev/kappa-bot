import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` reads schema only and does not need a DB.
// `drizzle-kit migrate` requires the direct (non-pooler) Neon URL.
export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./packages/db/src/schema/*",
  ...(process.env.DATABASE_URL_UNPOOLED
    ? { dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED } }
    : {}),
});
