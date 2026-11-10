import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { getEnv } from "@/core/env";
import * as schema from "./schema";

let sqlite: Database.Database | undefined;
let db: BetterSQLite3Database<typeof schema> | undefined;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!db) {
    const dataDir = getEnv().dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    sqlite = new Database(path.join(dataDir, "holdall.db"));
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export function closeDb(): void {
  sqlite?.close();
  sqlite = undefined;
  db = undefined;
}
