import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

export async function useTempDatabase(prefix: string) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `holdall-${prefix}-`));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.stubEnv("INIT_CWD", "");
  const { runMigrations } = await import("../../scripts/db-migrate");
  runMigrations(dataDir);
  return {
    dataDir,
    async cleanup() {
      (await import("@/core/db/client")).closeDb();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export async function insertUser(id: string) {
  const { getDb } = await import("@/core/db/client");
  const { user } = await import("@/core/db/schema");
  getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com`, emailVerified: false, role: "user", createdAt: new Date(), updatedAt: new Date() })
    .run();
}
