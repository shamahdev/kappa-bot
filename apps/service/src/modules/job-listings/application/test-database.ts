import type { Database } from "@kappa/db";
import { getTableName } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/** Offline statement spy, not a SQL engine. Reads are explicit scripted results. */
export const testDatabase = (
  reads: unknown[][] = [],
  returned: unknown[] = []
) => {
  interface Write {
    operation: string;
    table: string;
    values?: unknown;
    where?: SQL;
  }
  const writes: Write[] = [];
  let readCount = 0;
  let transactionCount = 0;
  const chain = (rows: unknown[], write?: Write) => {
    const result = Promise.resolve(rows);
    return Object.assign(result, {
      from: () => chain(rows),
      innerJoin: () => chain(rows),
      leftJoin: () => chain(rows),
      limit: () => chain(rows),
      offset: () => chain(rows),
      onConflictDoNothing: () => chain(rows),
      onConflictDoUpdate: () => chain(rows),
      orderBy: () => chain(rows),
      returning: () => Promise.resolve(returned),
      where: (condition: SQL) => {
        if (write) {
          write.where = condition;
        }
        return chain(rows, write);
      },
    });
  };
  const fake = {
    delete(table: PgTable) {
      const write = { operation: "delete", table: getTableName(table) };
      writes.push(write);
      return chain(returned, write);
    },
    insert(table: PgTable) {
      return {
        values(values: unknown) {
          writes.push({
            operation: "insert",
            table: getTableName(table),
            values,
          });
          return chain([]);
        },
      };
    },
    select() {
      readCount += 1;
      return chain(reads.shift() ?? []);
    },
    transaction<T>(run: (db: Database) => Promise<T>): Promise<T> {
      transactionCount += 1;
      try {
        return Promise.resolve(run(fake as unknown as Database));
      } catch (error) {
        return Promise.reject(error);
      }
    },
    update(table: PgTable) {
      return {
        set(values: unknown) {
          const write = {
            operation: "update",
            table: getTableName(table),
            values,
          };
          writes.push(write);
          return chain(returned, write);
        },
      };
    },
  };
  return {
    db: fake as unknown as Database,
    get readCount() {
      return readCount;
    },
    get transactionCount() {
      return transactionCount;
    },
    writes,
  };
};
