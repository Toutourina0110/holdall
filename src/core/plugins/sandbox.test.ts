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

  it("lets interface code call its own server functions and pushes live events only to people who turned it on", async () => {
    const { confirmInstall, stagePlugin } = await import("./install");
    const { setPluginEnabledFor } = await import("./store");
    const { callPluginFunction } = await import("./host");
    const { onPluginEvent } = await import("./live");
    const server = `
export default function (holdall) {
  holdall.handle("greet", async ({ name }, context) => {
    await holdall.storage.set("last", name, context);
    holdall.push(context.userId, "greeted", { name });
    holdall.push("bob", "greeted", { name: "leak" });
    return "Hello " + name;
  });
}
`;
    const staged = stagePlugin(
      archive({ ...base, id: "com.test.live", name: "Live", permissions: ["storage"], entry: { server: "server.mjs" } }, { "server.mjs": server }),
      { source: "third-party" },
    );
    confirmInstall(staged.stageId, [], "alice");
    setPluginEnabledFor("alice", "com.test.live", true);
    const alice: unknown[] = [];
    const bob: unknown[] = [];
    const stopAlice = onPluginEvent("com.test.live", "alice", (message) => alice.push(message));
    const stopBob = onPluginEvent("com.test.live", "bob", (message) => bob.push(message));
    expect(await callPluginFunction("com.test.live", "greet", { name: "Ada" }, "alice")).toBe("Hello Ada");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(alice).toEqual([{ event: "greeted", data: { name: "Ada" } }]);
    expect(bob).toEqual([]);
    await expect(callPluginFunction("com.test.live", "missing", {}, "alice")).rejects.toThrow(/no server function/);
    stopAlice();
    stopBob();
  }, 30000);

  it("refuses dangerous permissions unless the server allows them, and maps the others to Node flags", async () => {
    const { confirmInstall, stagePlugin } = await import("./install");
    const { getInstalledPlugin, setPluginPermission } = await import("./store");
    const { nodeFlags } = await import("./host");
    const { getEnv } = await import("@/core/env");
    expect(getEnv().allowUnsafePlugins).toBe(false);
    expect(() =>
      stagePlugin(archive({ ...base, id: "com.test.root", name: "Root", permissions: ["system"], entry: { server: "s.mjs" } }, { "s.mjs": "export default () => {}" }), {
        source: "third-party",
      }),
    ).toThrow(/ALLOW_UNSAFE_PLUGINS/);
    const staged = stagePlugin(
      archive({ ...base, id: "com.test.maybe", name: "Maybe", optionalPermissions: ["fs:host", "network:any"], entry: { server: "s.mjs" } }, { "s.mjs": "export default () => {}" }),
      { source: "third-party" },
    );
    confirmInstall(staged.stageId, ["fs:host", "network:any"], "alice");
    const granted = getInstalledPlugin("com.test.maybe")!.granted;
    expect(granted.has("fs:host")).toBe(false);
    expect(granted.has("network:any")).toBe(true);
    expect(() => setPluginPermission("com.test.maybe", "fs:host", true)).toThrow(/ALLOW_UNSAFE_PLUGINS/);

    const flags = (permissions: string[]) => nodeFlags("/plugin", "/runner.mjs", (permission) => permissions.includes(permission));
    expect(flags(["system"])).toEqual([]);
    expect(flags([])).toContain("--permission");
    expect(flags([])).not.toContain("--allow-net");
    expect(flags(["network:direct"])).toContain("--allow-net");
    expect(flags(["process:spawn"])).toContain("--allow-child-process");
    expect(flags(["fs:host"])).toEqual(expect.arrayContaining(["--allow-fs-read=*", "--allow-fs-write=*"]));
  });

  it("keeps network.fetch to declared https hosts unless broader network permissions were granted", async () => {
    const { confirmInstall, stagePlugin } = await import("./install");
    const { setPluginEnabledFor } = await import("./store");
    const { callPluginApi } = await import("./api");
    const staged = stagePlugin(
      archive({ ...base, id: "com.test.net", name: "Net", permissions: ["network"], network: ["api.example.com"], entry: { ui: "u.html" } }, { "u.html": "x" }),
      { source: "third-party" },
    );
    confirmInstall(staged.stageId, [], "alice");
    setPluginEnabledFor("alice", "com.test.net", true);
    const context = { pluginId: "com.test.net", userId: "alice" };
    await expect(callPluginApi("network.fetch", { url: "https://other.example.com/" }, context)).rejects.toThrow(/did not declare/);
    await expect(callPluginApi("network.fetch", { url: "http://api.example.com/" }, context)).rejects.toThrow(/https/);
    await expect(callPluginApi("network.fetch", { url: "https://x/" }, { pluginId: "com.test.notes", userId: "alice" })).rejects.toThrow(/network/);
  });

  it("signs plugin file links for one plugin and one person, for a limited time", async () => {
    const { signAssetToken, verifyAssetToken } = await import("./asset-token");
    const token = signAssetToken("com.test.live", "alice", 1000);
    expect(verifyAssetToken("com.test.live", token, 2000)).toBe("alice");
    expect(verifyAssetToken("com.test.other", token, 2000)).toBeUndefined();
    expect(verifyAssetToken("com.test.live", token, 1000 + 13 * 60 * 60 * 1000)).toBeUndefined();
    expect(verifyAssetToken("com.test.live", token.replace(/.$/, (c) => (c === "A" ? "B" : "A")), 2000)).toBeUndefined();
    const [payload, mac] = token.split(".");
    const forged = `${Buffer.from(`bob:${Buffer.from(payload!, "base64url").toString().split(":")[1]}`).toString("base64url")}.${mac}`;
    expect(verifyAssetToken("com.test.live", forged, 2000)).toBeUndefined();
  });

  it("runs the tutorial plugin from the documentation", async () => {
    await import("@/modules/notes/register");
    const { confirmInstall, stagePlugin } = await import("./install");
    const { setPluginEnabledFor } = await import("./store");
    const { callPluginApi } = await import("./api");
    const { doAction } = await import("./hooks");
    const { createNote } = await import("@/modules/notes/store");
    const { listNotifications } = await import("@/core/notifications/store");
    const root = path.join(process.cwd(), "examples", "plugins", "word-count");
    const files: Record<string, string> = {};
    for (const name of ["server.mjs", "ui/widget.html", "ui/page.html"]) files[name] = fs.readFileSync(path.join(root, name), "utf8");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "holdall.plugin.json"), "utf8"));
    const staged = stagePlugin(archive(manifest, files), { source: "third-party" });
    confirmInstall(staged.stageId, ["notifications"], "alice");
    setPluginEnabledFor("alice", manifest.id, true);
    const note = createNote("alice", { title: "Draft", content: Array.from({ length: 520 }, () => "word").join(" ") });
    await doAction("notes.saved", { id: note.id, title: note.title }, { userId: "alice" });
    const today = new Date().toISOString().slice(0, 10);
    const day = (await callPluginApi("storage.get", { key: `day:${today}` }, { pluginId: manifest.id, userId: "alice" })) as { notes: Record<string, number> };
    expect(day.notes[note.id]).toBe(520);
    expect(listNotifications("alice").some((row) => row.title === "You wrote 520 words today")).toBe(true);
  }, 30000);

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
