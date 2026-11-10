import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/core/db/client";
import { appSetting, invitation, user } from "@/core/db/schema";
import { getEnv } from "@/core/env";
import { getAuth } from "./server";
import { withSignupGrant } from "./signup-grant";

export const accountInput = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80, "Use 80 characters or fewer."),
  email: z.email("Enter a valid email address.").max(200),
  password: z.string().min(10, "Use at least 10 characters.").max(128, "Use 128 characters or fewer."),
});

export type AccountInput = z.infer<typeof accountInput>;

const invitationDays = 7;

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
  const db = getDb();
  const claimed = db
    .insert(appSetting)
    .values({ key: "setup.completed", value: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
  if (claimed.changes === 0 || countUsers() > 0) {
    throw new Error("Holdall is already set up. Sign in instead.");
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
  if (!isRegistrationOpen()) throw new Error("Registration is closed. Ask an admin for an invitation.");
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
  if (!open) throw new Error("This invitation link is invalid, expired or already used. Ask an admin for a new one.");
  const claimed = db
    .update(invitation)
    .set({ usedAt: new Date() })
    .where(and(eq(invitation.id, open.id), isNull(invitation.usedAt)))
    .run();
  if (claimed.changes === 0) throw new Error("This invitation link was just used. Ask an admin for a new one.");
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
