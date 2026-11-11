import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";
import type { CalendarProvider, EventFields, RemoteEvent } from "./types";

const remote = new Map<string, RemoteEvent>();
let counter = 0;

const fake: CalendarProvider = {
  listCalendars: async () => [{ remoteId: "work", name: "Work", readOnly: false }],
  listEvents: async () => [...remote.values()],
  createEvent: async (_c, _cal, fields: EventFields) => {
    const remoteId = `r${++counter}`;
    remote.set(remoteId, { ...fields, remoteId, recurring: false, updatedAt: new Date() });
    return { remoteId };
  },
  updateEvent: async (_c, _cal, remoteId, _etag, fields) => {
    remote.set(remoteId, { ...fields, remoteId, recurring: false, updatedAt: new Date() });
    return {};
  },
  deleteEvent: async (_c, _cal, remoteId) => {
    remote.delete(remoteId);
  },
};

vi.mock("./providers", () => ({
  providerFor: () => fake,
  freshCredentials: async (_p: unknown, credentials: unknown) => ({ credentials, changed: false }),
}));

let db: Awaited<ReturnType<typeof useTempDatabase>>;

beforeAll(async () => {
  db = await useTempDatabase("sync");
  await insertUser("alice");
  await insertUser("bob");
});

afterAll(async () => {
  await db.cleanup();
});

describe("calendar sync", () => {
  it("does not let another user sync or change the status of an account", async () => {
    const store = await import("./store");
    const { requestSync } = await import("./sync");
    const account = store.addAccount("alice", { provider: "caldav", name: "Private", credentials: { kind: "basic", serverUrl: "https://x.example", username: "u", password: "p" } });
    expect(() => requestSync("bob", account.id)).toThrow("does not exist");
    store.setAccountStatus("bob", account.id, "error", "changed by bob");
    expect(store.getAccount("alice", account.id).error).toBeNull();
    store.removeAccount("alice", account.id);
  });

  it("pulls, pushes local changes, and follows remote deletions", async () => {
    const store = await import("./store");
    const { syncAccount } = await import("./sync");
    const soon = Date.now() + 86400000;
    remote.set("a", { remoteId: "a", title: "Standup", description: "", location: "", start: new Date(soon), end: new Date(soon + 1800000), allDay: false, recurring: false, updatedAt: new Date(Date.now() - 60000) });
    remote.set("b", { remoteId: "b", title: "Old meeting", description: "", location: "", start: new Date(soon), end: new Date(soon + 3600000), allDay: false, recurring: false, updatedAt: new Date(Date.now() - 60000) });
    const account = store.addAccount("alice", { provider: "caldav", name: "Work", credentials: { kind: "basic", serverUrl: "https://x.example", username: "u", password: "p" } });

    await syncAccount("alice", account.id);
    const titles = () => store.listEvents("alice", new Date(Date.now() - 86400000), new Date(Date.now() + 7 * 86400000)).map((event) => event.title).sort();
    expect(titles()).toEqual(["Old meeting", "Standup"]);

    const standup = store.listEvents("alice", new Date(0), new Date(soon + 86400000)).find((event) => event.title === "Standup")!;
    store.updateEvent("alice", standup.id, { title: "Standup (moved)" });
    const calendarId = standup.calendarId;
    store.createEvent("alice", { calendarId, title: "Lunch", start: new Date(soon), end: new Date(soon + 3600000) });
    remote.delete("b");

    await syncAccount("alice", account.id);
    expect(titles()).toEqual(["Lunch", "Standup (moved)"]);
    expect([...remote.values()].map((event) => event.title).sort()).toEqual(["Lunch", "Standup (moved)"]);
  });
});
