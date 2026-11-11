"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/core/auth/session";
import { clearNotifications, deleteNotification, markAllRead } from "@/core/notifications/store";

export async function markAllReadAction(): Promise<void> {
  const session = await requireSession();
  markAllRead(session.user.id);
  revalidatePath("/", "layout");
}

export async function deleteNotificationAction(id: unknown): Promise<void> {
  const session = await requireSession();
  if (typeof id === "string") deleteNotification(session.user.id, id);
  revalidatePath("/", "layout");
}

export async function clearNotificationsAction(): Promise<void> {
  const session = await requireSession();
  clearNotifications(session.user.id);
  revalidatePath("/", "layout");
}
