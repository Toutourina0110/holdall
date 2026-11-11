import { randomBytes, randomUUID } from "node:crypto";
import { and, like, lt, sql } from "drizzle-orm";
import { deleteAccount } from "@/core/auth/accounts";
import { getAuth } from "@/core/auth/server";
import { withSignupGrant } from "@/core/auth/signup-grant";
import { getDb } from "@/core/db/client";
import { user } from "@/core/db/schema";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { createLogger } from "@/core/log";
import { seedDemo } from "./seed";

const log = createLogger("demo");
const demoDomain = "demo.holdall.invalid";
const maxDemoAccounts = 300;
const perAddress = 5;
const windowMs = 10 * 60 * 1000;
const recent = new Map<string, number[]>();

export function isDemoEmail(email: string): boolean {
  return email.endsWith(`@${demoDomain}`);
}

function demoUsers() {
  return like(user.email, `%@${demoDomain}`);
}

const perMinute = 30;
let lastMinute: number[] = [];

function allowAddress(address: string): boolean {
  const now = Date.now();
  lastMinute = lastMinute.filter((time) => now - time < 60 * 1000);
  if (lastMinute.length >= perMinute) return false;
  if (recent.size > 10000) {
    for (const [key, times] of recent) if (times.every((time) => now - time >= windowMs)) recent.delete(key);
  }
  const times = (recent.get(address) ?? []).filter((time) => now - time < windowMs);
  if (times.length >= perAddress) return false;
  recent.set(address, [...times, now]);
  lastMinute.push(now);
  return true;
}

export async function startDemoSession(address: string): Promise<Headers> {
  if (!getEnv().demoMode) throw new UserFacingError("The demo is turned off on this Holdall.");
  if (!allowAddress(address)) throw new UserFacingError("Too many demo accounts from your address. Wait a few minutes and try again.");
  const count = getDb().select({ count: sql<number>`count(*)` }).from(user).where(demoUsers()).get()?.count ?? 0;
  if (count >= maxDemoAccounts) throw new UserFacingError("The demo is full right now. Try again in a few minutes.");
  const email = `${randomUUID()}@${demoDomain}`;
  const password = randomBytes(24).toString("base64url");
  const result = await withSignupGrant("user", () => getAuth().api.signUpEmail({ body: { name: "Demo visitor", email, password }, returnHeaders: true }));
  try {
    seedDemo(result.response.user.id);
  } catch (error) {
    log.warn("Could not fill the demo account", { error: String(error) });
  }
  return result.headers;
}

export function resetExpiredDemos(): number {
  const cutoff = new Date(Date.now() - getEnv().demoResetMinutes * 60 * 1000);
  const expired = getDb().select({ id: user.id }).from(user).where(and(demoUsers(), lt(user.createdAt, cutoff))).all();
  for (const row of expired) deleteAccount(row.id);
  return expired.length;
}

const timerKey = Symbol.for("holdall.demoReset");
const store = globalThis as unknown as Record<symbol, ReturnType<typeof setInterval> | undefined>;

export function startDemoReset(): void {
  if (store[timerKey] || !getEnv().demoMode) return;
  const tick = () => {
    try {
      const removed = resetExpiredDemos();
      if (removed) log.info("Demo accounts reset", { removed });
    } catch (error) {
      log.warn("Could not reset demo accounts", { error: String(error) });
    }
  };
  store[timerKey] = setInterval(tick, 60 * 1000);
  store[timerKey].unref?.();
  tick();
}
