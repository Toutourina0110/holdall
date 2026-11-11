import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";
import { buildEvent, parseEvents } from "./ical";
import { davFetch } from "./providers";
import { resolveConflict } from "./types";

describe("conflicts", () => {
  const older = new Date("2026-11-10T10:00:00Z");
  const newer = new Date("2026-11-10T12:00:00Z");

  it("keeps the most recent change", () => {
    expect(resolveConflict({ dirty: true, updatedAt: newer }, { updatedAt: older })).toBe("local");
    expect(resolveConflict({ dirty: true, updatedAt: older }, { updatedAt: newer })).toBe("remote");
  });

  it("takes the remote version when nothing changed locally", () => {
    expect(resolveConflict({ dirty: false, updatedAt: newer }, { updatedAt: older })).toBe("remote");
  });
});

describe("iCalendar", () => {
  it("round-trips an event", () => {
    const ics = buildEvent("uid-1", {
      title: "Dentist",
      description: "Bring the card",
      location: "12 rue des Lilas",
      start: new Date("2026-11-12T09:30:00Z"),
      end: new Date("2026-11-12T10:15:00Z"),
      allDay: false,
    });
    const [event] = parseEvents(ics, "a.ics", '"1"', new Date("2026-11-01"), new Date("2026-12-01"));
    expect(event).toMatchObject({ title: "Dentist", location: "12 rue des Lilas", allDay: false, recurring: false });
    expect(event!.start.toISOString()).toBe("2026-11-12T09:30:00.000Z");
  });

  it("expands recurring events inside the window only", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:weekly",
      "SUMMARY:Swimming",
      "DTSTART:20261102T163000Z",
      "DTEND:20261102T180000Z",
      "RRULE:FREQ=WEEKLY;COUNT=10",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const events = parseEvents(ics, "w.ics", undefined, new Date("2026-11-08T00:00:00Z"), new Date("2026-11-30T00:00:00Z"));
    expect(events.map((event) => event.start.toISOString().slice(0, 10))).toEqual(["2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(new Set(events.map((event) => event.remoteId)).size).toBe(3);
  });
});

let db: Awaited<ReturnType<typeof useTempDatabase>>;

describe("calendar data", () => {
  beforeAll(async () => {
    db = await useTempDatabase("calendar");
    await insertUser("alice");
    await insertUser("bob");
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it("stores passwords encrypted and never lets another user see events", async () => {
    const store = await import("./store");
    const account = store.addAccount("alice", {
      provider: "caldav",
      name: "Nextcloud",
      credentials: { kind: "basic", serverUrl: "https://cloud.example.com/remote.php/dav", username: "alice", password: "super-secret-app-password" },
    });
    const { getDb } = await import("@/core/db/client");
    const { calendarAccount } = await import("@/core/db/schema");
    const raw = getDb().select().from(calendarAccount).all().find((row) => row.id === account.id)!;
    expect(raw.credentials).not.toContain("super-secret-app-password");
    expect(store.accountCredentials("alice", account.id)).toMatchObject({ password: "super-secret-app-password" });
    expect(() => store.accountCredentials("bob", account.id)).toThrow();

    const local = store.localCalendar("alice");
    const event = store.createEvent("alice", {
      calendarId: local.id,
      title: "Private",
      description: "",
      location: "",
      start: new Date("2026-11-12T09:00:00Z"),
      end: new Date("2026-11-12T10:00:00Z"),
      allDay: false,
    });
    expect(store.listEvents("bob", new Date("2026-11-01"), new Date("2026-12-01"))).toHaveLength(0);
    expect(() => store.updateEvent("bob", event.id, { title: "Hacked" })).toThrow();
    expect(() => store.deleteEvent("bob", event.id)).toThrow();
    expect(() => store.createEvent("bob", { ...event, calendarId: local.id })).toThrow();
    expect(store.listEvents("alice", new Date("2026-11-01"), new Date("2026-12-01")).map((item) => item.title)).toEqual(["Private"]);
  });
});

describe("caldav requests", () => {
  const send = davFetch("https://caldav.example.com/dav/", false);

  it("refuses addresses on another site", async () => {
    await expect(send("https://attacker.example.org/steal", { method: "PROPFIND" })).rejects.toThrow("another site");
  });

  it("refuses private and loopback addresses", async () => {
    await expect(davFetch("https://127.0.0.1/", false)("https://127.0.0.1/dav/")).rejects.toThrow("private or internal");
    await expect(davFetch("http://caldav.example.com/", false)("http://caldav.example.com/dav/")).rejects.toThrow("Only https");
  });
});
