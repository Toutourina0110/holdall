import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { decrypt, encrypt } from "@/core/crypto";
import { getDb } from "@/core/db/client";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { calendar, calendarAccount, calendarEvent, calendarHistory } from "./db";
import type { Credentials, EventFields, Provider } from "./types";

export type CalendarRow = typeof calendar.$inferSelect;
export type EventRow = typeof calendarEvent.$inferSelect;
export type AccountRow = typeof calendarAccount.$inferSelect;

export const eventInput = z
  .object({
    calendarId: z.string().max(64),
    title: z.string().trim().min(1, "Enter a title.").max(300),
    description: z.string().max(20000).default(""),
    location: z.string().max(300).default(""),
    start: z.coerce.date(),
    end: z.coerce.date(),
    allDay: z.boolean().default(false),
  })
  .refine((value) => value.end.getTime() >= value.start.getTime(), { message: "The end must be after the start.", path: ["end"] });

export type EventInput = z.input<typeof eventInput>;

function own<T extends { userId: string }>(row: T | undefined, message: string): T {
  if (!row) throw new UserFacingError(message);
  return row;
}

export function addAccount(userId: string, input: { provider: Provider; name: string; credentials?: Credentials }): AccountRow {
  const row: AccountRow = {
    id: randomUUID(),
    userId,
    provider: input.provider,
    name: input.name.trim().slice(0, 80) || input.provider,
    credentials: input.credentials ? encrypt(JSON.stringify(input.credentials), getEnv().appSecret) : null,
    status: "ok",
    error: null,
    lastSyncAt: null,
    createdAt: new Date(),
  };
  getDb().insert(calendarAccount).values(row).run();
  return row;
}

export function getAccount(userId: string, id: string): AccountRow {
  return own(
    getDb().select().from(calendarAccount).where(and(eq(calendarAccount.id, id), eq(calendarAccount.userId, userId))).get(),
    "This calendar account does not exist.",
  );
}

export function listAccounts(userId: string): AccountRow[] {
  return getDb().select().from(calendarAccount).where(eq(calendarAccount.userId, userId)).orderBy(asc(calendarAccount.createdAt)).all();
}

export function allSyncedAccounts(): AccountRow[] {
  return getDb().select().from(calendarAccount).all().filter((row) => row.provider !== "local");
}

export function accountCredentials(userId: string, id: string): Credentials {
  const account = getAccount(userId, id);
  if (!account.credentials) throw new UserFacingError("This account has no saved credentials.");
  return JSON.parse(decrypt(account.credentials, getEnv().appSecret)) as Credentials;
}

export function saveCredentials(userId: string, id: string, credentials: Credentials): void {
  getAccount(userId, id);
  getDb()
    .update(calendarAccount)
    .set({ credentials: encrypt(JSON.stringify(credentials), getEnv().appSecret) })
    .where(eq(calendarAccount.id, id))
    .run();
}

export function setAccountStatus(id: string, status: AccountRow["status"], error: string | null): void {
  getDb()
    .update(calendarAccount)
    .set({ status, error, ...(status === "ok" ? { lastSyncAt: new Date() } : {}) })
    .where(eq(calendarAccount.id, id))
    .run();
}

export function removeAccount(userId: string, id: string): void {
  const account = getAccount(userId, id);
  if (account.provider === "local") throw new UserFacingError("The Holdall calendar cannot be removed.");
  getDb().delete(calendarAccount).where(eq(calendarAccount.id, id)).run();
}

export function localCalendar(userId: string): CalendarRow {
  const db = getDb();
  let account = db
    .select()
    .from(calendarAccount)
    .where(and(eq(calendarAccount.userId, userId), eq(calendarAccount.provider, "local")))
    .get();
  account ??= addAccount(userId, { provider: "local", name: "Holdall" });
  const existing = db.select().from(calendar).where(eq(calendar.accountId, account.id)).get();
  if (existing) return existing;
  const row: CalendarRow = { id: randomUUID(), userId, accountId: account.id, remoteId: "local", name: "Holdall", color: "#1f4a7a", readOnly: false, enabled: true };
  db.insert(calendar).values(row).run();
  return row;
}

export function listCalendars(userId: string): (CalendarRow & { provider: Provider; accountName: string })[] {
  localCalendar(userId);
  return getDb()
    .select({ calendar, provider: calendarAccount.provider, accountName: calendarAccount.name })
    .from(calendar)
    .innerJoin(calendarAccount, eq(calendarAccount.id, calendar.accountId))
    .where(eq(calendar.userId, userId))
    .orderBy(asc(calendarAccount.createdAt), asc(calendar.name))
    .all()
    .map((row) => ({ ...row.calendar, provider: row.provider, accountName: row.accountName }));
}

export function getCalendar(userId: string, id: string): CalendarRow {
  return own(getDb().select().from(calendar).where(and(eq(calendar.id, id), eq(calendar.userId, userId))).get(), "This calendar does not exist.");
}

export function setCalendarEnabled(userId: string, id: string, enabled: boolean): void {
  getCalendar(userId, id);
  getDb().update(calendar).set({ enabled }).where(eq(calendar.id, id)).run();
}

export function upsertCalendars(userId: string, accountId: string, remote: { remoteId: string; name: string; color?: string; readOnly: boolean }[]): CalendarRow[] {
  const db = getDb();
  const existing = db.select().from(calendar).where(eq(calendar.accountId, accountId)).all();
  const seen = new Set<string>();
  for (const item of remote) {
    seen.add(item.remoteId);
    const color = item.color && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : "#1f4a7a";
    const found = existing.find((row) => row.remoteId === item.remoteId);
    if (found) db.update(calendar).set({ name: item.name.slice(0, 120), color, readOnly: item.readOnly }).where(eq(calendar.id, found.id)).run();
    else db.insert(calendar).values({ id: randomUUID(), userId, accountId, remoteId: item.remoteId, name: item.name.slice(0, 120), color, readOnly: item.readOnly, enabled: true }).run();
  }
  const gone = existing.filter((row) => !seen.has(row.remoteId)).map((row) => row.id);
  if (gone.length) db.delete(calendar).where(inArray(calendar.id, gone)).run();
  return db.select().from(calendar).where(eq(calendar.accountId, accountId)).all();
}

export function listEvents(userId: string, from: Date, to: Date): (EventRow & { color: string; calendarName: string })[] {
  return getDb()
    .select({ event: calendarEvent, color: calendar.color, calendarName: calendar.name, enabled: calendar.enabled })
    .from(calendarEvent)
    .innerJoin(calendar, eq(calendar.id, calendarEvent.calendarId))
    .where(and(eq(calendarEvent.userId, userId), eq(calendarEvent.deleted, false), lt(calendarEvent.start, to), gt(calendarEvent.end, from)))
    .orderBy(asc(calendarEvent.start))
    .limit(2000)
    .all()
    .filter((row) => row.enabled)
    .map((row) => ({ ...row.event, color: row.color, calendarName: row.calendarName }));
}

export function getEvent(userId: string, id: string): EventRow {
  return own(getDb().select().from(calendarEvent).where(and(eq(calendarEvent.id, id), eq(calendarEvent.userId, userId))).get(), "This event does not exist.");
}

function writable(userId: string, calendarId: string): CalendarRow {
  const row = getCalendar(userId, calendarId);
  if (row.readOnly) throw new UserFacingError("This calendar is read only.");
  return row;
}

export function createEvent(userId: string, input: EventInput): EventRow {
  const data = eventInput.parse(input);
  writable(userId, data.calendarId);
  const row: EventRow = {
    id: randomUUID(),
    userId,
    ...data,
    remoteId: null,
    etag: null,
    recurring: false,
    dirty: true,
    deleted: false,
    updatedAt: new Date(),
    remoteUpdatedAt: null,
  };
  getDb().insert(calendarEvent).values(row).run();
  return row;
}

export function updateEvent(userId: string, id: string, input: Partial<EventInput>): EventRow {
  const current = getEvent(userId, id);
  if (current.recurring) throw new UserFacingError("Repeating events can only be changed in the calendar they come from.");
  const data = eventInput.parse({ ...current, ...input });
  writable(userId, current.calendarId);
  if (data.calendarId !== current.calendarId) writable(userId, data.calendarId);
  getDb()
    .update(calendarEvent)
    .set({ ...data, dirty: true, updatedAt: new Date() })
    .where(eq(calendarEvent.id, id))
    .run();
  return getEvent(userId, id);
}

export function deleteEvent(userId: string, id: string): void {
  const current = getEvent(userId, id);
  if (current.recurring) throw new UserFacingError("Repeating events can only be deleted in the calendar they come from.");
  writable(userId, current.calendarId);
  if (!current.remoteId) getDb().delete(calendarEvent).where(eq(calendarEvent.id, id)).run();
  else getDb().update(calendarEvent).set({ deleted: true, dirty: true, updatedAt: new Date() }).where(eq(calendarEvent.id, id)).run();
}

export function recordHistory(userId: string, eventId: string | null, title: string, message: string): void {
  getDb().insert(calendarHistory).values({ id: randomUUID(), userId, eventId, title: title.slice(0, 300), message, createdAt: new Date() }).run();
}

export function listHistory(userId: string) {
  return getDb().select().from(calendarHistory).where(eq(calendarHistory.userId, userId)).orderBy(desc(calendarHistory.createdAt)).limit(50).all();
}

export function eventsForCalendar(calendarId: string): EventRow[] {
  return getDb().select().from(calendarEvent).where(eq(calendarEvent.calendarId, calendarId)).all();
}

export function toFields(row: EventRow): EventFields {
  return { title: row.title, description: row.description, location: row.location, start: row.start, end: row.end, allDay: row.allDay };
}
