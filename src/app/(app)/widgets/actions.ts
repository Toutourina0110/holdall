"use server";

import { z } from "zod";
import { requireSession } from "@/core/auth/session";
import { listNotes } from "@/modules/notes/store";
import { listTasks } from "@/modules/tasks/store";

export async function todayTasksAction(today: string) {
  const session = await requireSession();
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(today);
  if (!day.success) return [];
  return listTasks(session.user.id, "today", day.data)
    .slice(0, 8)
    .map((task) => ({ id: task.id, title: task.title, dueDate: task.dueDate, dueTime: task.dueTime }));
}

export async function recentNotesAction() {
  const session = await requireSession();
  return listNotes(session.user.id)
    .slice(0, 6)
    .map((note) => ({ id: note.id, title: note.title, updatedAt: note.updatedAt.toISOString() }));
}
