import fs from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;
let secretPath: string;

const hostileServer = `
import fs from "node:fs";
export default function (holdall) {
  holdall.on("notes.saved", async (payload, context) => {
    const out = {};
    try { fs.readFileSync(payload.secretPath, "utf8"); out.read = "allowed"; } catch (error) { out.read = error.code ?? "blocked"; }
    try { await fetch("https://example.com"); out.net = "allowed"; } catch { out.net = "blocked"; }
    try { (await import("node:child_process")).execSync("echo hi"); out.spawn = "allowed"; } catch (error) { out.spawn = error.code ?? "blocked"; }
    try { await holdall.storage.set("k", 1, context); out.storage = "allowed"; } catch { out.storage = "denied"; }
    try { await holdall.storage.set("k", 1, { callId: "forged" }); out.forged = "allowed"; } catch { out.forged = "denied"; }
    return out;
  });
}
`;

function archive(manifest: object, files: Record<string, string>) {
  return zipSync({
    "holdall.plugin.json": strToU8(JSON.stringify(manifest)),
    ...Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])),
  });
}

const base = { version: "1.0.0", type: "extension", author: { name: "Test" }, license: "MIT", holdall: ">=0.0.1" };

beforeAll(async () => {
  db = await useTempDatabase("sandbox");
  await insertUser("alice");
  await insertUser("bob");
  secretPath = path.join(db.dataDir, "secret.txt");
  fs.writeFileSync(secretPath, "do not read");
});

afterAll(async () => {
  (await import("./host")).stopAllPluginProcesses();
  await db.cleanup();
});

describe("plugin sandbox", () => {
  it("keeps a hostile plugin away from files, network, programs and ungranted APIs", async () => {
    const { confirmInstall, stagePlugin } = await import("./install");
    const { setPluginEnabledFor } = await import("./store");
    const { callPluginHook } = await import("./host");
    const staged = stagePlugin(
      archive(
        { ...base, id: "com.test.hostile", name: "Hostile", permissions: ["notes:read", "hooks:notes.saved"], entry: { server: "server.mjs" }, contributes: { hooks: ["notes.saved"] } },
        { "server.mjs": hostileServer },
      ),
      { source: "third-party" },
    );
    confirmInstall(staged.stageId, [], "alice");
    setPluginEnabledFor("alice", "com.test.hostile", true);
    const result = (await callPluginHook("com.test.hostile", "notes.saved", { secretPath }, "alice", 15000)) as Record<string, string>;
    expect(result.read).toBe("ERR_ACCESS_DENIED");
    expect(result.net).toBe("blocked");
    expect(result.spawn).toBe("ERR_ACCESS_DENIED");
    expect(result.storage).toBe("denied");
    expect(result.forged).toBe("denied");
  }, 30000);

  it("keeps each user's plugin storage separate and requires the plugin to be enabled", async () => {
    const { confirmInstall, stagePlugin } = await import("./install");
    const { setPluginEnabledFor } = await import("./store");
    const { callPluginApi } = await import("./api");
    const staged = stagePlugin(
      archive({ ...base, id: "com.test.notes", name: "Notes", permissions: ["storage"], entry: { ui: "ui.html" } }, { "ui.html": "<p>x</p>" }),
      { source: "third-party" },
    );
    confirmInstall(staged.stageId, [], "alice");
    setPluginEnabledFor("alice", "com.test.notes", true);
    await callPluginApi("storage.set", { key: "draft", value: "alice secret" }, { pluginId: "com.test.notes", userId: "alice" });
    await expect(callPluginApi("storage.get", { key: "draft" }, { pluginId: "com.test.notes", userId: "bob" })).rejects.toThrow(/turned off/);
    setPluginEnabledFor("bob", "com.test.notes", true);
    expect(await callPluginApi("storage.get", { key: "draft" }, { pluginId: "com.test.notes", userId: "bob" })).toBeNull();
    expect(await callPluginApi("storage.get", { key: "draft" }, { pluginId: "com.test.notes", userId: "alice" })).toBe("alice secret");
    await expect(callPluginApi("network.fetch", { url: "https://example.com" }, { pluginId: "com.test.notes", userId: "alice" })).rejects.toThrow(/network/);
  });

  it("keeps plugin file access and notifications inside the calling user's own data", async () => {
    await import("@/modules/files/register");
    const { confirmInstall, stagePlugin } = await import("./install");
    const { setPluginEnabledFor } = await import("./store");
    const { callPluginApi } = await import("./api");
    const { listNotifications } = await import("@/core/notifications/store");
    const staged = stagePlugin(
      archive(
        { ...base, id: "com.test.files", name: "Files test", permissions: ["files:read", "files:write", "notifications"], entry: { ui: "ui.html" } },
        { "ui.html": "<p>x</p>" },
      ),
      { source: "third-party" },
    );
    confirmInstall(staged.stageId, [], "alice");
    for (const user of ["alice", "bob"]) setPluginEnabledFor(user, "com.test.files", true);
    const alice = { pluginId: "com.test.files", userId: "alice" };
    const bob = { pluginId: "com.test.files", userId: "bob" };

    const written = (await callPluginApi("files.write", { path: "Reports/today.txt", content: "alice only" }, alice)) as { path: string };
    expect(written.path).toBe("Reports/today.txt");
    expect(fs.existsSync(path.join(db.dataDir, "files", "alice", "Reports", "today.txt"))).toBe(true);
    expect(((await callPluginApi("files.read", { path: "Reports/today.txt" }, alice)) as { content: string }).content).toBe("alice only");
    await expect(callPluginApi("files.read", { path: "Reports/today.txt" }, bob)).rejects.toThrow();
    await expect(callPluginApi("files.read", { path: "../alice/Reports/today.txt" }, bob)).rejects.toThrow();
    await expect(callPluginApi("files.write", { path: "../alice/evil.txt", content: "x" }, bob)).rejects.toThrow();
    await expect(callPluginApi("files.read", { path: "../../holdall.db", encoding: "base64" }, alice)).rejects.toThrow();
    expect(fs.existsSync(path.join(db.dataDir, "files", "alice", "evil.txt"))).toBe(false);

    await expect(callPluginApi("files.list", { path: "" }, { pluginId: "com.test.notes", userId: "alice" })).rejects.toThrow(/files:read/);

    await expect(callPluginApi("notifications.show", { title: "" }, alice)).rejects.toThrow();
    await callPluginApi("notifications.show", { title: "For Alice" }, alice);
    expect(listNotifications("alice").map((row) => row.title)).toEqual(["For Alice"]);
    expect(listNotifications("bob")).toHaveLength(0);
  });

  it("only accepts filter answers that keep to what Holdall offered", async () => {
    const { confirmInstall, stagePlugin } = await import("./install");
    const { setPluginEnabledFor } = await import("./store");
    const { filterCalendarEvents, filterDashboardWidgets, noteExportFormats, renderNoteExport } = await import("./filters");
    const server = `
export default function (holdall) {
  holdall.on("dashboard.widgets", (widgets) => [...widgets.filter((w) => w.id !== "tasks.today"), { id: "fake.widget", label: "Fake" }]);
  holdall.on("calendar.event.render", (events) => events.map((e) => ({ ...e, title: "[x] " + e.title })));
  holdall.on("notes.export.formats", (formats) => [...formats, { id: "upper", label: "Upper case", extension: "txt" }]);
  holdall.on("notes.export.render", ({ note }) => ({ content: note.content.toUpperCase() }));
}
`;
    const hooksList = ["dashboard.widgets", "calendar.event.render", "notes.export.formats", "notes.export.render"];
    const staged = stagePlugin(
      archive(
        {
          ...base,
          id: "com.test.filters",
          name: "Filters",
          permissions: ["ui:slots", "calendar:read", "notes:read", ...hooksList.map((hook) => `hooks:${hook}`)],
          entry: { server: "server.mjs" },
          contributes: { hooks: hooksList },
        },
        { "server.mjs": server },
      ),
      { source: "third-party" },
    );
    confirmInstall(staged.stageId, [], "alice");
    setPluginEnabledFor("alice", "com.test.filters", true);

    const widgets = [
      { id: "tasks.today", slot: "dashboard.widgets" as const, label: "Due today", icon: "tasks" as const, order: 1, source: "tasks" },
      { id: "notes.recent", slot: "dashboard.widgets" as const, label: "Recent notes", icon: "notes" as const, order: 2, source: "notes" },
    ];
    expect((await filterDashboardWidgets(widgets, "alice")).map((item) => item.id)).toEqual(["tasks.today", "notes.recent"]);

    const events = await filterCalendarEvents([{ id: "e1", title: "Dentist", color: "#1f4a7a" }], "alice");
    expect(events[0]!.title).toBe("[x] Dentist");
    expect(await filterCalendarEvents([{ id: "e1", title: "Dentist", color: "#1f4a7a" }], "bob")).toEqual([{ id: "e1", title: "Dentist", color: "#1f4a7a" }]);

    expect((await noteExportFormats("alice")).map((format) => format.id)).toEqual(["upper"]);
    expect(await renderNoteExport("alice", "com.test.filters", "upper", { id: "n1", title: "Hi", content: "hello" })).toEqual({ content: "HELLO", extension: "txt" });
    expect(await renderNoteExport("alice", "com.test.filters", "missing", { id: "n1", title: "Hi", content: "hello" })).toBeUndefined();
    expect(await renderNoteExport("bob", "com.test.filters", "upper", { id: "n1", title: "Hi", content: "hello" })).toBeUndefined();
  }, 30000);
});
