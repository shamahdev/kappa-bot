import { fileURLToPath } from 'node:url';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export type GatewayDb = NodePgDatabase;

let pool: Pool | undefined;

/** Long-lived gateway pool on the POOLED Neon URL (research-04 §2). */
export function createDb(connectionString: string): { db: GatewayDb; pool: Pool } {
  pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  return { db: drizzle(pool), pool };
}

/** Migrations always run on the DIRECT url (pooled PgBouncer rejects locks). */
export async function runMigrations(directUrl: string): Promise<void> {
  const p = new Pool({ connectionString: directUrl, max: 1 });
  try {
    // Absolute path: drizzle/ stays at the repo root no matter which workspace
    // boots (apps/* run with the repo root as CWD, but never rely on it).
    const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
    await migrate(drizzle(p), { migrationsFolder });
  } finally {
    await p.end();
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
