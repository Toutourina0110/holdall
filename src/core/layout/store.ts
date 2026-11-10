import { eq } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { userLayout } from "@/core/db/schema";
import { emptyLayout, userLayoutSchema, type UserLayout } from "./schema";

export function getUserLayout(userId: string): UserLayout {
  const row = getDb().select().from(userLayout).where(eq(userLayout.userId, userId)).get();
  if (!row) return emptyLayout;
  const parsed = userLayoutSchema.safeParse(JSON.parse(row.layout));
  return parsed.success ? parsed.data : emptyLayout;
}

export function saveUserLayout(userId: string, layout: unknown): UserLayout {
  const valid = userLayoutSchema.parse(layout);
  const json = JSON.stringify(valid);
  getDb()
    .insert(userLayout)
    .values({ userId, version: valid.version, layout: json, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userLayout.userId, set: { version: valid.version, layout: json, updatedAt: new Date() } })
    .run();
  return valid;
}

export function resetUserLayout(userId: string): void {
  getDb().delete(userLayout).where(eq(userLayout.userId, userId)).run();
}
