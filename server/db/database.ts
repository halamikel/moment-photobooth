import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { config } from "../config.js";
import { DATABASE_SCHEMA } from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: config.isServerless ? 1 : 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (error) => {
  console.error("[db] unexpected idle client error", error);
});

export type Queryable = Pick<pg.PoolClient, "query">;

const transactionStorage = new AsyncLocalStorage<pg.PoolClient>();

export function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<R>> {
  const client = transactionStorage.getStore() ?? pool;
  return client.query<R>(text, params);
}

export async function inTransaction<T>(work: () => Promise<T>): Promise<T> {
  if (transactionStorage.getStore()) {
    return work();
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await transactionStorage.run(client, work);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

let schemaPromise: Promise<void> | null = null;

export function ensureDatabaseSchema(): Promise<void> {
  schemaPromise ??= inTransaction(async () => {
    await query("SELECT pg_advisory_xact_lock(hashtext('moment_schema'))");
    await query(DATABASE_SCHEMA);
  }).catch((error: unknown) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
