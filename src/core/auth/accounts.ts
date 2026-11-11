import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/core/db/client";
import { appSetting, invitation, passwordReset, user } from "@/core/db/schema";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { pluginDataPath, userPath, type UserArea } from "@/core/paths";
import { deleteUserSettings } from "@/core/plugins/settings";
import { getAuth } from "./server";
import { withSignupGrant } from "./signup-grant";

export const passwordInput = z.string().min(10, "Use at least 10 characters.").max(128, "Use 128 characters or fewer.");

export const accountInput = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80, "Use 80 characters or fewer."),
  email: z.email("Enter a valid email address.").max(200),
  password: passwordInput,
});

export type AccountInput = z.infer<typeof accountInput>;

const invitationDays = 7;
const resetMinutes = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function countUsers(): number {
  const row = getDb().select({ n: sql<number>`count(*)` }).from(user).get();
  return row?.n ?? 0;
}

async function signUp(role: "admin" | "user", input: AccountInput) {
  return withSignupGrant(role, () =>
    getAuth().api.signUpEmail({ body: { name: input.name, email: input.email, password: input.password } }),
  );
}

export async function createFirstAdmin(input: AccountInput) {
  if (getEnv().demoMode) throw new UserFacingError("The demo instance has no setup. Start the demo instead.");
  const db = getDb();
  const claimed = db
    .insert(appSetting)
    .values({ key: "setup.completed", value: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
  if (claimed.changes === 0 || countUsers() > 0) {
    throw new UserFacingError("Holdall is already set up. Sign in instead.");
  }
  try {
    return await signUp("admin", input);
  } catch (error) {
    db.delete(appSetting).where(eq(appSetting.key, "setup.completed")).run();
    throw error;
  }
}

export function isRegistrationOpen(): boolean {
  const row = getDb().select().from(appSetting).where(eq(appSetting.key, "registration.open")).get();
  return row ? row.value === "true" : getEnv().allowRegistration;
}

export function setRegistrationOpen(open: boolean): void {
  getDb()
    .insert(appSetting)
    .values({ key: "registration.open", value: String(open) })
    .onConflictDoUpdate({ target: appSetting.key, set: { value: String(open) } })
    .run();
}

export async function registerOpenAccount(input: AccountInput) {
  if (!isRegistrationOpen()) throw new UserFacingError("Registration is closed. Ask an admin for an invitation.");
  return signUp("user", input);
}

export function createInvitation(createdBy: string, role: "admin" | "user" = "user") {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + invitationDays * 24 * 60 * 60 * 1000);
  getDb()
    .insert(invitation)
    .values({ id: randomUUID(), tokenHash: hashToken(token), role, createdBy, expiresAt })
    .run();
  return { token, expiresAt };
}

export function findOpenInvitation(token: string) {
  return getDb()
    .select()
    .from(invitation)
    .where(and(eq(invitation.tokenHash, hashToken(token)), isNull(invitation.usedAt), gt(invitation.expiresAt, new Date())))
    .get();
}

export async function acceptInvitation(token: string, input: AccountInput) {
  const db = getDb();
  const open = findOpenInvitation(token);
  if (!open) throw new UserFacingError("This invitation link is invalid, expired or already used. Ask an admin for a new one.");
  const claimed = db
    .update(invitation)
    .set({ usedAt: new Date() })
    .where(and(eq(invitation.id, open.id), isNull(invitation.usedAt)))
    .run();
  if (claimed.changes === 0) throw new UserFacingError("This invitation link was just used. Ask an admin for a new one.");
  try {
    const result = await signUp(open.role, input);
    db.update(invitation).set({ usedBy: result.user.id }).where(eq(invitation.id, open.id)).run();
    return result;
  } catch (error) {
    db.update(invitation).set({ usedAt: null }).where(eq(invitation.id, open.id)).run();
    throw error;
  }
}

export function listInvitations() {
  return getDb().select().from(invitation).orderBy(sql`${invitation.createdAt} desc`).all();
}

export function revokeInvitation(id: string) {
  getDb().delete(invitation).where(and(eq(invitation.id, id), isNull(invitation.usedAt))).run();
}

export function createPasswordReset(createdBy: string, userId: string) {
  const db = getDb();
  if (!db.select({ id: user.id }).from(user).where(eq(user.id, userId)).get()) throw new UserFacingError("This account no longer exists.");
  db.delete(passwordReset).where(and(eq(passwordReset.userId, userId), isNull(passwordReset.usedAt))).run();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + resetMinutes * 60 * 1000);
  db.insert(passwordReset).values({ id: randomUUID(), tokenHash: hashToken(token), userId, createdBy, expiresAt }).run();
  return { token, expiresAt };
}

export function findOpenPasswordReset(token: string) {
  return getDb()
    .select()
    .from(passwordReset)
    .where(and(eq(passwordReset.tokenHash, hashToken(token)), isNull(passwordReset.usedAt), gt(passwordReset.expiresAt, new Date())))
    .get();
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const db = getDb();
  const open = findOpenPasswordReset(token);
  if (!open) throw new UserFacingError("This reset link is invalid, expired or already used. Ask an admin for a new one.");
  const claimed = db
    .update(passwordReset)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordReset.id, open.id), isNull(passwordReset.usedAt)))
    .run();
  if (claimed.changes === 0) throw new UserFacingError("This reset link was just used. Ask an admin for a new one.");
  try {
    const context = await getAuth().$context;
    const hash = await context.password.hash(passwordInput.parse(password));
    if (await context.internalAdapter.findCredentialAccount(open.userId)) {
      await context.internalAdapter.updatePassword(open.userId, hash);
    } else {
      await context.internalAdapter.createAccount({ userId: open.userId, providerId: "credential", accountId: open.userId, password: hash });
    }
    await context.internalAdapter.deleteUserSessions(open.userId);
  } catch (error) {
    db.update(passwordReset).set({ usedAt: null }).where(eq(passwordReset.id, open.id)).run();
    throw error;
  }
}

export function listUsers() {
  return getDb()
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
    .from(user)
    .orderBy(user.createdAt)
    .all();
}

export function setUserRole(userId: string, role: "admin" | "user") {
  const db = getDb();
  const target = db.select().from(user).where(eq(user.id, userId)).get();
  if (!target) throw new UserFacingError("This account no longer exists.");
  if (target.role === "admin" && role !== "admin") {
    const admins = db.select({ n: sql<number>`count(*)` }).from(user).where(eq(user.role, "admin")).get()?.n ?? 0;
    if (admins <= 1) throw new UserFacingError("Holdall needs at least one admin. Make someone else admin first.");
  }
  db.update(user).set({ role }).where(eq(user.id, userId)).run();
}

const userAreas: UserArea[] = ["notes", "files", "downloads"];

export function deleteAccount(userId: string): void {
  deleteUserSettings(userId);
  getDb().delete(user).where(eq(user.id, userId)).run();
  for (const area of userAreas) fs.rmSync(userPath(getEnv().dataDir, area, userId), { recursive: true, force: true });
  const pluginData = path.join(getEnv().dataDir, "plugin-data");
  if (fs.existsSync(pluginData)) {
    for (const pluginId of fs.readdirSync(pluginData)) {
      try {
        fs.rmSync(pluginDataPath(getEnv().dataDir, pluginId, "users", userId), { recursive: true, force: true });
      } catch {
        continue;
      }
    }
  }
}
