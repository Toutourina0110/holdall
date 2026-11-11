"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { caldav } from "@/modules/calendar/providers";
import {
  addAccount,
  createEvent,
  deleteEvent,
  listEvents,
  removeAccount,
  setCalendarEnabled,
  updateEvent,
  type EventInput,
} from "@/modules/calendar/store";
import { requestSync } from "@/modules/calendar/sync";
import { listTasks } from "@/modules/tasks/store";

type Result<T = object> = T | { error: string };

function failure(error: unknown): { error: string } {
  if (error instanceof UserFacingError) return { error: error.message };
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check the fields and try again." };
  return { error: "Something went wrong. Try again in a moment." };
}

export type CalendarItem = {
  id: string;
  kind: "event" | "task";
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  calendarId?: string;
  calendarName?: string;
  location?: string;
  description?: string;
  editable: boolean;
};

export async function loadRangeAction(from: string, to: string): Promise<Result<{ items: CalendarItem[] }>> {
  const session = await requireSession();
  try {
    const start = z.coerce.date().parse(from);
    const end = z.coerce.date().parse(to);
    if (end.getTime() - start.getTime() > 62 * 86400000) throw new UserFacingError("Choose a shorter period.");
    const events: CalendarItem[] = listEvents(session.user.id, start, end).map((event) => ({
      id: event.id,
      kind: "event",
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      allDay: event.allDay,
      color: event.color,
      calendarId: event.calendarId,
      calendarName: event.calendarName,
      location: event.location,
      description: event.description,
      editable: !event.recurring,
    }));
    const today = start.toISOString().slice(0, 10);
    const last = end.toISOString().slice(0, 10);
    const tasks: CalendarItem[] = [...listTasks(session.user.id, "today", today), ...listTasks(session.user.id, "upcoming", today)]
      .filter((task) => task.dueDate && task.dueDate >= today && task.dueDate <= last)
      .map((task) => ({
        id: task.id,
        kind: "task",
        title: task.title,
        start: `${task.dueDate}T${task.dueTime ?? "00:00"}:00`,
        end: `${task.dueDate}T${task.dueTime ?? "00:00"}:00`,
        allDay: !task.dueTime,
        color: "#2f6b3f",
        editable: false,
      }));
    return { items: [...events, ...tasks] };
  } catch (error) {
    return failure(error);
  }
}

export async function saveEventAction(id: string | undefined, input: EventInput): Promise<Result> {
  const session = await requireSession();
  try {
    if (id) updateEvent(session.user.id, id, input);
    else createEvent(session.user.id, input);
    revalidatePath("/calendar");
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function deleteEventAction(id: string): Promise<Result> {
  const session = await requireSession();
  try {
    deleteEvent(session.user.id, String(id));
    return {};
  } catch (error) {
    return failure(error);
  }
}

const caldavInput = z.object({
  kind: z.enum(["icloud", "caldav"]),
  serverUrl: z.url("Enter the full server address, starting with https://.").max(500).optional(),
  username: z.string().trim().min(1, "Enter your user name.").max(200),
  password: z.string().min(1, "Enter the app password.").max(500),
});

export async function addCaldavAction(input: unknown): Promise<Result> {
  const session = await requireSession();
  try {
    const data = caldavInput.parse(input);
    const serverUrl = data.kind === "icloud" ? "https://caldav.icloud.com" : data.serverUrl;
    if (!serverUrl || !/^https?:\/\//.test(serverUrl)) throw new UserFacingError("Enter the full server address, starting with https://.");
    const credentials = { kind: "basic" as const, serverUrl, username: data.username, password: data.password, allowPrivate: session.user.role === "admin" };
    await caldav.listCalendars(credentials);
    const account = addAccount(session.user.id, { provider: data.kind, name: data.kind === "icloud" ? "iCloud" : new URL(serverUrl).hostname, credentials });
    requestSync(session.user.id, account.id);
    revalidatePath("/calendar/accounts");
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function syncAccountAction(id: string): Promise<Result> {
  const session = await requireSession();
  try {
    requestSync(session.user.id, String(id));
    revalidatePath("/calendar/accounts");
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function removeAccountAction(id: string): Promise<Result> {
  const session = await requireSession();
  try {
    removeAccount(session.user.id, String(id));
    revalidatePath("/calendar/accounts");
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function setCalendarShownAction(id: string, shown: boolean): Promise<Result> {
  const session = await requireSession();
  try {
    setCalendarEnabled(session.user.id, String(id), Boolean(shown));
    revalidatePath("/calendar");
    return {};
  } catch (error) {
    return failure(error);
  }
}
