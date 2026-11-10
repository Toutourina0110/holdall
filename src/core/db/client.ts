import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { getEnv } from "@/core/env";
import * as schema from "./schema";

let db: BetterSQLite3Database<typeof schema> | undefined;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!db) {
    const sqlite = new Database(path.join(getEnv().dataDir, "holdall.db"));
    sqlite.pragma("journal_mode = WAL");
    db = drizzle(sqlite, { schema });
  }
  return db;
}
