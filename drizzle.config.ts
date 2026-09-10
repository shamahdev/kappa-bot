import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` reads schema only and does not need a DB.
// `drizzle-kit migrate` requires the direct (non-pooler) Neon URL.
export default defineConfig({
  schema: './src/features/*/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  ...(process.env.DATABASE_URL_UNPOOLED
    ? { dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED } }
    : {}),
});
