import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/core/db/client";
import { UserFacingError } from "@/core/errors";
import { getNote, saveNote } from "@/modules/notes/store";
import { task, taskList } from "./db";

export type TaskRow = typeof task.$inferSelect;
export type Task = Omit<TaskRow, "labels"> & { labels: string[] };
export type TaskView = "inbox" | "today" | "upcoming" | "done" | "list";

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-10.");
const timeText = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:30.");

export const taskInput = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(300),
  description: z.string().max(20000).default(""),
  dueDate: dateText.nullable().default(null),
  dueTime: timeText.nullable().default(null),
  priority: z.number().int().min(0).max(3).default(0),
  labels: z.array(z.string().trim().toLowerCase().regex(/^[\p{L}\p{N}_-]{1,30}$/u, "Use short labels without spaces.")).max(10).default([]),
  listId: z.string().max(64).nullable().default(null),
  parentId: z.string().max(64).nullable().default(null),
});

export type TaskInput = z.input<typeof taskInput>;

function toTask(row: TaskRow): Task {
  return { ...row, labels: JSON.parse(row.labels) as string[] };
}

function ownTask(userId: string, id: string): TaskRow {
  const row = getDb().select().from(task).where(and(eq(task.id, id), eq(task.userId, userId))).get();
  if (!row) throw new UserFacingError("This task does not exist or was deleted.");
  return row;
}

function ownList(userId: string, id: string) {
  const row = getDb().select().from(taskList).where(and(eq(taskList.id, id), eq(taskList.userId, userId))).get();
  if (!row) throw new UserFacingError("This list does not exist.");
  return row;
}

function checkRelations(userId: string, data: { listId: string | null; parentId: string | null }, selfId?: string) {
  if (data.listId) ownList(userId, data.listId);
  if (data.parentId) {
    if (data.parentId === selfId) throw new UserFacingError("A task cannot be its own subtask.");
    const parent = ownTask(userId, data.parentId);
    if (parent.parentId) throw new UserFacingError("Subtasks cannot have their own subtasks.");
  }
}

export function listTaskLists(userId: string) {
  return getDb().select().from(taskList).where(eq(taskList.userId, userId)).orderBy(asc(taskList.position), asc(taskList.createdAt)).all();
}

export function createTaskList(userId: string, name: string) {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new UserFacingError("Enter a list name.");
  const position = listTaskLists(userId).length;
  const row = { id: randomUUID(), userId, name: clean, position, createdAt: new Date() };
  getDb().insert(taskList).values(row).run();
  return row;
}

export function renameTaskList(userId: string, id: string, name: string) {
  ownList(userId, id);
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new UserFacingError("Enter a list name.");
  getDb().update(taskList).set({ name: clean }).where(eq(taskList.id, id)).run();
}

export function deleteTaskList(userId: string, id: string) {
  ownList(userId, id);
  getDb().delete(taskList).where(and(eq(taskList.id, id), eq(taskList.userId, userId))).run();
}

export function listTasks(userId: string, view: TaskView, today: string, listId?: string): Task[] {
  dateText.parse(today);
  const conditions = [eq(task.userId, userId), isNull(task.parentId)];
  if (view === "done") conditions.push(isNotNull(task.completedAt));
  else conditions.push(isNull(task.completedAt));
  if (view === "today") conditions.push(isNotNull(task.dueDate), lte(task.dueDate, today));
  if (view === "upcoming") conditions.push(gt(task.dueDate, today));
  if (view === "inbox") conditions.push(isNull(task.listId));
  if (view === "list") {
    if (!listId) return [];
    ownList(userId, listId);
    conditions.push(eq(task.listId, listId));
  }
  const parents = getDb()
    .select()
    .from(task)
    .where(and(...conditions))
    .orderBy(
      view === "done" ? desc(task.completedAt) : sql`${task.dueDate} is null`,
      asc(task.dueDate),
      asc(task.dueTime),
      desc(task.priority),
      asc(task.position),
      asc(task.createdAt),
    )
    .limit(500)
    .all();
  return parents.map(toTask);
}

export function subtasks(userId: string, parentIds: string[]): Task[] {
  if (parentIds.length === 0) return [];
  return getDb()
    .select()
    .from(task)
    .where(and(eq(task.userId, userId), inArray(task.parentId, parentIds)))
    .orderBy(asc(task.position), asc(task.createdAt))
    .all()
    .map(toTask);
}

export function getTask(userId: string, id: string): Task {
  return toTask(ownTask(userId, id));
}

export function createTask(userId: string, input: TaskInput, link?: { noteId: string; noteItem: string }): Task {
  const data = taskInput.parse(input);
  checkRelations(userId, data);
  if (link) getNote(userId, link.noteId);
  const now = new Date();
  const row: TaskRow = {
    id: randomUUID(),
    userId,
    ...data,
    labels: JSON.stringify(data.labels),
    position: 0,
    noteId: link?.noteId ?? null,
    noteItem: link?.noteItem.slice(0, 500) ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(task).values(row).run();
  return toTask(row);
}

export function updateTask(userId: string, id: string, input: Partial<TaskInput>): Task {
  const current = toTask(ownTask(userId, id));
  const data = taskInput.parse({ ...current, ...input });
  checkRelations(userId, data, id);
  getDb()
    .update(task)
    .set({ ...data, labels: JSON.stringify(data.labels), updatedAt: new Date() })
    .where(eq(task.id, id))
    .run();
  return getTask(userId, id);
}

function syncNoteCheckbox(userId: string, row: TaskRow, done: boolean) {
  if (!row.noteId || !row.noteItem) return;
  try {
    const detail = getNote(userId, row.noteId);
    if (detail.trashedAt) return;
    const escaped = row.noteItem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^(\\s*[-*+]\\s+\\[)[ xX](\\]\\s+${escaped}\\s*)$`, "m");
    if (!pattern.test(detail.content)) return;
    saveNote(userId, row.noteId, { content: detail.content.replace(pattern, `$1${done ? "x" : " "}$2`) });
  } catch {
    return;
  }
}

export function setTaskDone(userId: string, id: string, done: boolean): Task {
  const row = ownTask(userId, id);
  getDb()
    .update(task)
    .set({ completedAt: done ? new Date() : null, updatedAt: new Date() })
    .where(or(eq(task.id, id), and(eq(task.parentId, id), eq(task.userId, userId), sql`${done ? 1 : 0} = 1`)))
    .run();
  syncNoteCheckbox(userId, row, done);
  return getTask(userId, id);
}

export function deleteTask(userId: string, id: string): void {
  ownTask(userId, id);
  getDb()
    .delete(task)
    .where(and(eq(task.userId, userId), or(eq(task.id, id), eq(task.parentId, id))))
    .run();
}

export function tasksForNote(userId: string, noteId: string): Task[] {
  return getDb()
    .select()
    .from(task)
    .where(and(eq(task.userId, userId), eq(task.noteId, noteId)))
    .all()
    .map(toTask);
}

export function countDueToday(userId: string, today: string): number {
  return (
    getDb()
      .select({ n: sql<number>`count(*)` })
      .from(task)
      .where(and(eq(task.userId, userId), isNull(task.completedAt), isNotNull(task.dueDate), lte(task.dueDate, today)))
      .get()?.n ?? 0
  );
}
