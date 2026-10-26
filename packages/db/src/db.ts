import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export type Database = NodePgDatabase;

let pool: Pool | undefined;

export const createDb = (
  connectionString: string
): {
  db: Database;
  pool: Pool;
} => {
  pool = new Pool({ connectionString, idleTimeoutMillis: 30_000, max: 10 });
  return { db: drizzle(pool), pool };
};

/** Migrations always run on the DIRECT url (pooled PgBouncer rejects locks). */
export const runMigrations = async (directUrl: string): Promise<void> => {
  const p = new Pool({ connectionString: directUrl, max: 1 });
  try {
    // Absolute path: drizzle/ stays at the repo root no matter which workspace
    // boots (apps/* run with the repo root as CWD, but never rely on it).
    const migrationsFolder = fileURLToPath(
      new URL("../../../drizzle", import.meta.url)
    );
    await migrate(drizzle(p), { migrationsFolder });
  } finally {
    await p.end();
  }
};

export const closeDb = async (): Promise<void> => {
  await pool?.end();
  pool = undefined;
};
