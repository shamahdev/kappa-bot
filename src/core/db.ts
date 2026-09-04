import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { GatewayDb } from './feature';

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
    await migrate(drizzle(p), { migrationsFolder: './drizzle' });
  } finally {
    await p.end();
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
