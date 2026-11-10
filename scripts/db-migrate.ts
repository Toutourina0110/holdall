import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getEnv } from "../src/core/env.ts";
import { createLogger } from "../src/core/log/index.ts";

const migrationsFolder = path.resolve(import.meta.dirname, "..", "drizzle");

export function runMigrations(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, "holdall.db"));
  try {
    sqlite.pragma("journal_mode = WAL");
    migrate(drizzle(sqlite), { migrationsFolder });
  } finally {
    sqlite.close();
  }
}

if (import.meta.main) {
  const { dataDir } = getEnv();
  runMigrations(dataDir);
  createLogger("db").info("Migrations applied", { database: path.join(dataDir, "holdall.db") });
}
