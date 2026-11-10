import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "./db-migrate";

const tempDirs: string[] = [];
const journal = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "..", "drizzle", "meta", "_journal.json"), "utf8")) as { entries: unknown[] };
const migrationCount = journal.entries.length;

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "holdall-migrate-"));
  tempDirs.push(dir);
  return dir;
}

function countMigrations(dataDir: string): number {
  const db = new Database(path.join(dataDir, "holdall.db"), { readonly: true });
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations").get() as { n: number };
    return row.n;
  } finally {
    db.close();
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("runMigrations", () => {
  it("creates the database file and records every migration", () => {
    const dir = makeTempDir();
    runMigrations(dir);
    expect(fs.existsSync(path.join(dir, "holdall.db"))).toBe(true);
    expect(countMigrations(dir)).toBe(migrationCount);
  });

  it("is a no-op when run twice", () => {
    const dir = makeTempDir();
    runMigrations(dir);
    expect(() => runMigrations(dir)).not.toThrow();
    expect(countMigrations(dir)).toBe(migrationCount);
  });

  it("creates missing parent folders", () => {
    const dir = path.join(makeTempDir(), "nested", "dir");
    runMigrations(dir);
    expect(fs.existsSync(path.join(dir, "holdall.db"))).toBe(true);
  });
});
