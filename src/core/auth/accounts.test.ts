import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "holdall-auth-"));
vi.stubEnv("DATA_DIR", dataDir);
vi.stubEnv("INIT_CWD", "");

const password = "correct-horse-battery";

let accounts: typeof import("./accounts");
let auth: typeof import("./server");

beforeAll(async () => {
  const { runMigrations } = await import("../../../scripts/db-migrate");
  runMigrations(dataDir);
  accounts = await import("./accounts");
  auth = await import("./server");
});

afterAll(async () => {
  (await import("@/core/db/client")).closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("accounts", () => {
  it("blocks direct sign-up without the setup, invitation or registration path", async () => {
    await expect(
      auth.getAuth().api.signUpEmail({ body: { name: "Mallory", email: "mallory@example.com", password } }),
    ).rejects.toThrow(/setup, invitation or registration/);
    expect(accounts.countUsers()).toBe(0);
  });

  it("creates the first admin once, then refuses a second setup", async () => {
    const first = await accounts.createFirstAdmin({ name: "Ada", email: "ada@example.com", password });
    expect(first.user.email).toBe("ada@example.com");
    await expect(accounts.createFirstAdmin({ name: "Eve", email: "eve@example.com", password })).rejects.toThrow(/already set up/);
    expect(accounts.countUsers()).toBe(1);
  });

  it("gives the admin role to the first account only", async () => {
    const admin = auth.getAuth();
    const { getDb } = await import("@/core/db/client");
    const { user } = await import("@/core/db/schema");
    const rows = getDb().select().from(user).all();
    expect(rows.map((row) => row.role)).toEqual(["admin"]);
    expect(admin).toBeDefined();
  });

  it("accepts an invitation once, with the user role", async () => {
    const adminId = (await import("@/core/db/client")).getDb().select().from((await import("@/core/db/schema")).user).get()!.id;
    const { token } = accounts.createInvitation(adminId);
    const result = await accounts.acceptInvitation(token, { name: "Bob", email: "bob@example.com", password });
    expect(result.user.email).toBe("bob@example.com");
    await expect(
      accounts.acceptInvitation(token, { name: "Bob2", email: "bob2@example.com", password }),
    ).rejects.toThrow(/invalid, expired or already used/);
  });

  it("refuses an expired or unknown invitation", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { getDb } = await import("@/core/db/client");
    const { user } = await import("@/core/db/schema");
    const adminId = getDb().select().from(user).get()!.id;
    const { token } = accounts.createInvitation(adminId);
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    await expect(accounts.acceptInvitation(token, { name: "Late", email: "late@example.com", password })).rejects.toThrow();
    vi.useRealTimers();
    await expect(accounts.acceptInvitation("made-up", { name: "X", email: "x@example.com", password })).rejects.toThrow();
  });

  it("resets a password once with an admin link, signs the person out, and refuses expired links", async () => {
    const { getDb } = await import("@/core/db/client");
    const { session, user } = await import("@/core/db/schema");
    const { eq } = await import("drizzle-orm");
    const adminId = getDb().select().from(user).where(eq(user.role, "admin")).get()!.id;
    const bob = getDb().select().from(user).where(eq(user.email, "bob@example.com")).get()!;
    const api = auth.getAuth().api;
    await api.signInEmail({ body: { email: "bob@example.com", password } });
    expect(getDb().select().from(session).where(eq(session.userId, bob.id)).all().length).toBeGreaterThan(0);

    const { token } = accounts.createPasswordReset(adminId, bob.id);
    await expect(accounts.resetPassword(token, "short")).rejects.toThrow();
    await accounts.resetPassword(token, "a-brand-new-password");
    expect(getDb().select().from(session).where(eq(session.userId, bob.id)).all()).toHaveLength(0);
    await expect(api.signInEmail({ body: { email: "bob@example.com", password } })).rejects.toThrow();
    await api.signInEmail({ body: { email: "bob@example.com", password: "a-brand-new-password" } });
    await expect(accounts.resetPassword(token, "another-new-password")).rejects.toThrow(/invalid, expired or already used/);

    vi.useFakeTimers({ toFake: ["Date"] });
    const late = accounts.createPasswordReset(adminId, bob.id);
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    await expect(accounts.resetPassword(late.token, "another-new-password")).rejects.toThrow(/invalid, expired or already used/);
    vi.useRealTimers();
    await expect(accounts.resetPassword("made-up", "another-new-password")).rejects.toThrow();
  });

  it("refuses open registration while it is closed", async () => {
    await expect(accounts.registerOpenAccount({ name: "Zoe", email: "zoe@example.com", password })).rejects.toThrow(/closed/);
    accounts.setRegistrationOpen(true);
    const result = await accounts.registerOpenAccount({ name: "Zoe", email: "zoe@example.com", password });
    expect(result.user.email).toBe("zoe@example.com");
  });

  it("never removes the last admin", async () => {
    const { getDb } = await import("@/core/db/client");
    const { user } = await import("@/core/db/schema");
    const { eq } = await import("drizzle-orm");
    const admin = getDb().select().from(user).where(eq(user.role, "admin")).get()!;
    expect(() => accounts.setUserRole(admin.id, "user")).toThrow(/at least one admin/);
    const member = getDb().select().from(user).where(eq(user.role, "user")).get()!;
    accounts.setUserRole(member.id, "admin");
    accounts.setUserRole(admin.id, "user");
    expect(() => accounts.setUserRole(member.id, "user")).toThrow(/at least one admin/);
  });
});
