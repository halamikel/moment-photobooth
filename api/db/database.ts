import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config.js";
import { DATABASE_SCHEMA } from "./schema.js";

if (config.databasePath !== ":memory:") {
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
}

fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new DatabaseSync(config.databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA trusted_schema = OFF;
  PRAGMA temp_store = MEMORY;
`);

db.exec(DATABASE_SCHEMA);

if (typeof db.enableDefensive === "function") {
  db.enableDefensive(true);
}

export function inTransaction<T>(work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The transaction may already have been closed by SQLite.
    }
    throw error;
  }
}
