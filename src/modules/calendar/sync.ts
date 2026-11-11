import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { getEnv } from "@/core/env";
import { enqueueJob, listJobs, registerJobHandler } from "@/core/jobs/queue";
import { createLogger } from "@/core/log";
import { calendarEvent } from "./db";
import { freshCredentials, providerFor } from "./providers";
import {
  accountCredentials,
  allSyncedAccounts,
  eventsForCalendar,
  getAccount,
  recordHistory,
  saveCredentials,
  setAccountStatus,
  toFields,
  upsertCalendars,
} from "./store";
import { resolveConflict, type RemoteEvent } from "./types";

const log = createLogger("calendar");
const pastDays = 90;
const futureDays = 365;

export async function syncAccount(userId: string, accountId: string): Promise<{ pulled: number; pushed: number }> {
  const account = getAccount(userId, accountId);
  const provider = providerFor(account.provider);
  const fresh = await freshCredentials(account.provider, accountCredentials(userId, accountId));
  if (fresh.changed) saveCredentials(userId, accountId, fresh.credentials);
  const credentials = fresh.credentials;
  const from = new Date(Date.now() - pastDays * 86400000);
  const to = new Date(Date.now() + futureDays * 86400000);
  const db = getDb();
  let pulled = 0;
  let pushed = 0;

  const calendars = upsertCalendars(userId, accountId, await provider.listCalendars(credentials));
  for (const calendar of calendars.filter((item) => item.enabled)) {
    const remoteCalendar = { remoteId: calendar.remoteId, name: calendar.name, readOnly: calendar.readOnly };
    const local = eventsForCalendar(calendar.id);
    const byRemote = new Map(local.filter((row) => row.remoteId).map((row) => [row.remoteId!, row]));

    for (const row of local.filter((item) => item.dirty && !calendar.readOnly)) {
      try {
        if (row.deleted) {
          if (row.remoteId) await provider.deleteEvent(credentials, remoteCalendar, row.remoteId, row.etag ?? undefined);
          db.delete(calendarEvent).where(eq(calendarEvent.id, row.id)).run();
          if (row.remoteId) byRemote.delete(row.remoteId);
          pushed += 1;
        } else if (!row.remoteId) {
          const created = await provider.createEvent(credentials, remoteCalendar, toFields(row));
          db.update(calendarEvent).set({ remoteId: created.remoteId, etag: created.etag ?? null, dirty: false }).where(eq(calendarEvent.id, row.id)).run();
          byRemote.set(created.remoteId, { ...row, remoteId: created.remoteId, dirty: false });
          pushed += 1;
        }
      } catch (error) {
        recordHistory(userId, row.id, row.title, `Could not send this change: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const remote: RemoteEvent[] = await provider.listEvents(credentials, remoteCalendar, from, to);
    const seen = new Set<string>();
    for (const item of remote) {
      seen.add(item.remoteId);
      const existing = byRemote.get(item.remoteId);
      if (!existing) {
        db.insert(calendarEvent)
          .values({
            id: randomUUID(),
            userId,
            calendarId: calendar.id,
            remoteId: item.remoteId,
            etag: item.etag ?? null,
            title: item.title,
            description: item.description,
            location: item.location,
            start: item.start,
            end: item.end,
            allDay: item.allDay,
            recurring: item.recurring,
            dirty: false,
            deleted: false,
            updatedAt: item.updatedAt ?? new Date(),
            remoteUpdatedAt: item.updatedAt ?? null,
          })
          .run();
        pulled += 1;
        continue;
      }
      if (existing.deleted) continue;
      const winner = resolveConflict(existing, item);
      if (winner === "local" && existing.dirty && !calendar.readOnly) {
        try {
          const result = await provider.updateEvent(credentials, remoteCalendar, item.remoteId, item.etag ?? existing.etag ?? undefined, toFields(existing));
          db.update(calendarEvent).set({ etag: result.etag ?? item.etag ?? null, dirty: false }).where(eq(calendarEvent.id, existing.id)).run();
          if (item.updatedAt && existing.remoteUpdatedAt && item.updatedAt > existing.remoteUpdatedAt) {
            recordHistory(userId, existing.id, existing.title, "Changed here and in the other calendar. The change made here was newer and was kept.");
          }
          pushed += 1;
        } catch (error) {
          recordHistory(userId, existing.id, existing.title, `Could not send this change: ${error instanceof Error ? error.message : String(error)}`);
        }
        continue;
      }
      if (existing.dirty) recordHistory(userId, existing.id, existing.title, "Changed here and in the other calendar. The other change was newer and replaced this one.");
      db.update(calendarEvent)
        .set({
          etag: item.etag ?? null,
          title: item.title,
          description: item.description,
          location: item.location,
          start: item.start,
          end: item.end,
          allDay: item.allDay,
          recurring: item.recurring,
          dirty: false,
          updatedAt: item.updatedAt ?? new Date(),
          remoteUpdatedAt: item.updatedAt ?? null,
        })
        .where(eq(calendarEvent.id, existing.id))
        .run();
      pulled += 1;
    }

    for (const row of eventsForCalendar(calendar.id)) {
      if (!row.remoteId || seen.has(row.remoteId) || row.dirty) continue;
      if (row.end < from || row.start > to) continue;
      db.delete(calendarEvent).where(eq(calendarEvent.id, row.id)).run();
    }
  }
  return { pulled, pushed };
}

registerJobHandler("calendar.sync", async (job, context) => {
  const { accountId } = job.payload as { accountId: string };
  if (getEnv().demoMode) throw new Error("Calendar sync is turned off on the demo instance.");
  getAccount(job.userId, accountId);
  setAccountStatus(job.userId, accountId, "syncing", null);
  context.progress(0.1, "Syncing");
  try {
    const result = await syncAccount(job.userId, accountId);
    setAccountStatus(job.userId, accountId, "ok", null);
    return result;
  } catch (error) {
    setAccountStatus(job.userId, accountId, "error", error instanceof Error ? error.message.slice(0, 300) : String(error));
    throw error;
  }
});

export function requestSync(userId: string, accountId: string): string | undefined {
  getAccount(userId, accountId);
  const pending = listJobs(userId, "calendar.sync").some(
    (job) => (job.status === "queued" || job.status === "running") && (JSON.parse(job.payload) as { accountId: string }).accountId === accountId,
  );
  if (pending) return undefined;
  return enqueueJob({ userId, type: "calendar.sync", payload: { accountId }, maxAttempts: 1 });
}

const globalKey = Symbol.for("holdall.calendarScheduler");
const store = globalThis as unknown as Record<symbol, ReturnType<typeof setInterval> | undefined>;

export function startCalendarScheduler(): void {
  if (store[globalKey] || getEnv().demoMode) return;
  const tick = () => {
    for (const account of allSyncedAccounts()) {
      try {
        requestSync(account.userId, account.id);
      } catch (error) {
        log.warn("Could not schedule calendar sync", { error: String(error) });
      }
    }
  };
  store[globalKey] = setInterval(tick, 15 * 60 * 1000);
  store[globalKey].unref?.();
  setTimeout(tick, 30000).unref?.();
}
