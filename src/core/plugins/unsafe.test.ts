import fs from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;

beforeAll(async () => {
  vi.stubEnv("ALLOW_UNSAFE_PLUGINS", "true");
  db = await useTempDatabase("unsafe");
  await insertUser("alice");
});

afterAll(async () => {
  (await import("./host")).stopAllPluginProcesses();
  await db.cleanup();
});

const server = `
import fs from "node:fs";
import { execFileSync } from "node:child_process";
export default function (holdall) {
  holdall.handle("probe", ({ file }) => {
    const out = {};
    try { fs.writeFileSync(file, "written"); out.write = fs.readFileSync(file, "utf8"); } catch (error) { out.write = error.code ?? "blocked"; }
    try { out.spawn = execFileSync(process.execPath, ["-e", "process.stdout.write('ran')"]).toString(); } catch (error) { out.spawn = error.code ?? "blocked"; }
    return out;
  });
}
`;

describe("plugins with dangerous permissions on a server that allows them", () => {
  it("can write files anywhere and start programs when granted", async () => {
    const { confirmInstall, stagePlugin } = await import("./install");
    const { setPluginEnabledFor } = await import("./store");
    const { callPluginFunction } = await import("./host");
    const manifest = {
      id: "com.test.power",
      name: "Power",
      version: "1.0.0",
      type: "extension",
      author: { name: "Test" },
      license: "MIT",
      holdall: ">=0.0.1",
      permissions: ["fs:host", "process:spawn"],
      entry: { server: "server.mjs" },
    };
    const staged = stagePlugin(zipSync({ "holdall.plugin.json": strToU8(JSON.stringify(manifest)), "server.mjs": strToU8(server) }), { source: "third-party" });
    confirmInstall(staged.stageId, [], "alice");
    setPluginEnabledFor("alice", "com.test.power", true);
    const file = path.join(db.dataDir, "outside.txt");
    expect(await callPluginFunction("com.test.power", "probe", { file }, "alice", 20000)).toEqual({ write: "written", spawn: "ran" });
    expect(fs.readFileSync(file, "utf8")).toBe("written");
  }, 30000);
});
