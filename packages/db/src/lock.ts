import type { Pool, PoolClient } from "pg";

/**
 * Cross-process mutual exclusion for long-running work. The Postgres
 * implementation holds a session-level advisory lock on a dedicated
 * connection, so the lock spans AI calls without keeping a transaction open.
 */
export interface GenerationLock {
  acquire: (key: string) => Promise<(() => void | Promise<void>) | null>;
}

const releaseClient = async (
  client: PoolClient,
  key: string
): Promise<void> => {
  try {
    await client.query("select pg_advisory_unlock(hashtext($1))", [key]);
  } finally {
    client.release();
  }
};

export const createPostgresGenerationLock = (pool: Pool): GenerationLock => ({
  async acquire(key) {
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ locked: boolean }>(
        "select pg_try_advisory_lock(hashtext($1)) as locked",
        [key]
      );
      if (rows[0]?.locked !== true) {
        client.release();
        return null;
      }
      let released = false;
      return async () => {
        if (released) {
          return;
        }
        released = true;
        await releaseClient(client, key);
      };
    } catch (error) {
      client.release();
      throw error;
    }
  },
});

/** In-process fallback used by tests and single-process callers. */
export const createMemoryGenerationLock = (): GenerationLock => {
  const held = new Set<string>();
  return {
    acquire(key) {
      if (held.has(key)) {
        return Promise.resolve(null);
      }
      held.add(key);
      let released = false;
      return Promise.resolve(() => {
        if (!released) {
          released = true;
          held.delete(key);
        }
      });
    },
  };
};
