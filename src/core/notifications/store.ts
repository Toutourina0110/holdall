import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { notification } from "@/core/db/schema";
import { UserFacingError } from "@/core/errors";

const keepPerUser = 100;
const perSourcePerHour = 30;

export type NotificationRow = typeof notification.$inferSelect;

export function addNotification(userId: string, source: string, title: string, body = ""): string {
  const db = getDb();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent =
    db
      .select({ n: sql<number>`count(*)` })
      .from(notification)
      .where(and(eq(notification.userId, userId), eq(notification.source, source), gt(notification.createdAt, hourAgo)))
      .get()?.n ?? 0;
  if (recent >= perSourcePerHour) throw new UserFacingError("Too many notifications in the last hour. Try again later.");
  const id = randomUUID();
  db.insert(notification).values({ id, userId, source, title, body }).run();
  const kept = db
    .select({ id: notification.id })
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(keepPerUser)
    .all()
    .map((row) => row.id);
  db.delete(notification).where(and(eq(notification.userId, userId), notInArray(notification.id, kept))).run();
  return id;
}

export function listNotifications(userId: string): NotificationRow[] {
  return getDb().select().from(notification).where(eq(notification.userId, userId)).orderBy(desc(notification.createdAt)).all();
}

export function unreadCount(userId: string): number {
  return (
    getDb()
      .select({ n: sql<number>`count(*)` })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)))
      .get()?.n ?? 0
  );
}

export function markAllRead(userId: string): void {
  getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)))
    .run();
}

export function deleteNotification(userId: string, id: string): void {
  getDb()
    .delete(notification)
    .where(and(eq(notification.userId, userId), eq(notification.id, id)))
    .run();
}

export function clearNotifications(userId: string): void {
  getDb().delete(notification).where(eq(notification.userId, userId)).run();
}
