import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;

beforeAll(async () => {
  db = await useTempDatabase("demo");
});

afterAll(async () => {
  await db.cleanup();
});

describe("demo reset", () => {
  it("deletes only demo accounts older than the reset delay, with their files", async () => {
    const { getDb } = await import("@/core/db/client");
    const { user } = await import("@/core/db/schema");
    const { resetExpiredDemos } = await import("./demo");
    const { seedDemo } = await import("./seed");
    const { listNotes } = await import("@/modules/notes/store");
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const add = (id: string, email: string, createdAt: Date) =>
      getDb().insert(user).values({ id, name: id, email, emailVerified: false, role: "user", createdAt, updatedAt: createdAt }).run();

    add("demoold", "a@demo.holdall.invalid", old);
    add("demonew", "b@demo.holdall.invalid", new Date());
    add("realold", "real@example.com", old);
    await insertUser("realnew");
    for (const id of ["demoold", "demonew", "realold"]) seedDemo(id);
    expect(listNotes("demoold").length).toBeGreaterThan(0);

    expect(resetExpiredDemos()).toBe(1);
    const left = getDb().select({ id: user.id }).from(user).all().map((row) => row.id).sort();
    expect(left).toEqual(["demonew", "realnew", "realold"]);
    expect(fs.existsSync(path.join(db.dataDir, "notes", "demoold"))).toBe(false);
    expect(listNotes("realold").length).toBeGreaterThan(0);
    expect(listNotes("demonew").length).toBeGreaterThan(0);
  });
});
