import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const defaultMigrations = path.resolve(import.meta.dirname, "..", "drizzle");

export function runMigrations(dataDir: string, migrationsFolder = defaultMigrations): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, "holdall.db"));
  try {
    sqlite.pragma("journal_mode = WAL");
    migrate(drizzle(sqlite), { migrationsFolder });
  } finally {
    sqlite.close();
  }
}
