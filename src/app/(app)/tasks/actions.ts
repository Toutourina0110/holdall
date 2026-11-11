"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { doAction } from "@/core/plugins/hooks";
import {
  createTask,
  createTaskList,
  deleteTask,
  deleteTaskList,
  listTasks,
  renameTaskList,
  setTaskDone,
  subtasks,
  updateTask,
  type Task,
  type TaskInput,
} from "@/modules/tasks/store";

type Result<T = object> = T | { error: string };

const view = z.enum(["inbox", "today", "upcoming", "done", "list"]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function failure(error: unknown): { error: string } {
  if (error instanceof UserFacingError) return { error: error.message };
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check the fields and try again." };
  return { error: "Something went wrong. Try again in a moment." };
}

export async function loadTasksAction(input: { view: string; today: string; listId?: string }): Promise<Result<{ tasks: Task[]; subtasks: Task[] }>> {
  const session = await requireSession();
  const parsed = z.object({ view, today: day, listId: z.string().max(64).optional() }).safeParse(input);
  if (!parsed.success) return { error: "This view could not be loaded." };
  try {
    const tasks = listTasks(session.user.id, parsed.data.view, parsed.data.today, parsed.data.listId);
    return { tasks, subtasks: subtasks(session.user.id, tasks.map((item) => item.id)) };
  } catch (error) {
    return failure(error);
  }
}

export async function createTaskAction(input: TaskInput): Promise<Result<{ task: Task }>> {
  const session = await requireSession();
  try {
    const task = createTask(session.user.id, input);
    revalidatePath("/");
    return { task };
  } catch (error) {
    return failure(error);
  }
}

export async function updateTaskAction(id: string, input: Partial<TaskInput>): Promise<Result<{ task: Task }>> {
  const session = await requireSession();
  try {
    const task = updateTask(session.user.id, id, input);
    revalidatePath("/");
    return { task };
  } catch (error) {
    return failure(error);
  }
}

export async function setDoneAction(id: string, done: boolean): Promise<Result> {
  const session = await requireSession();
  try {
    const task = setTaskDone(session.user.id, id, Boolean(done));
    if (done) void doAction("tasks.completed", { id: task.id, title: task.title }, { userId: session.user.id }).catch(() => undefined);
    revalidatePath("/");
    revalidatePath("/notes");
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTaskAction(id: string): Promise<Result> {
  const session = await requireSession();
  try {
    deleteTask(session.user.id, id);
    revalidatePath("/");
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function createListAction(name: string): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  try {
    const list = createTaskList(session.user.id, String(name));
    revalidatePath("/tasks");
    return { id: list.id };
  } catch (error) {
    return failure(error);
  }
}

export async function renameListAction(id: string, name: string): Promise<Result> {
  const session = await requireSession();
  try {
    renameTaskList(session.user.id, id, String(name));
    revalidatePath("/tasks");
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function deleteListAction(id: string): Promise<Result> {
  const session = await requireSession();
  try {
    deleteTaskList(session.user.id, id);
    revalidatePath("/tasks");
    return {};
  } catch (error) {
    return failure(error);
  }
}
