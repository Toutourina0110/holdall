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
});
