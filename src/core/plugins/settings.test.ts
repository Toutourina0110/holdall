import { strToU8, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;

beforeAll(async () => {
  db = await useTempDatabase("settings");
  await insertUser("alice");
  await insertUser("bob");
  const { confirmInstall, stagePlugin } = await import("./install");
  const { setPluginEnabledFor } = await import("./store");
  const manifest = {
    id: "com.test.weather",
    name: "Weather",
    version: "1.0.0",
    type: "extension",
    author: { name: "Test" },
    license: "MIT",
    holdall: ">=0.0.1",
    entry: { ui: "u.html" },
    contributes: {
      settings: [
        { key: "apiKey", label: "API key", type: "secret", scope: "global" },
        { key: "city", label: "City", type: "text", scope: "personal", default: "Paris" },
        { key: "units", label: "Units", type: "select", scope: "personal", options: [{ value: "c", label: "Celsius" }, { value: "f", label: "Fahrenheit" }] },
        { key: "days", label: "Days", type: "number", scope: "personal", min: 1, max: 7 },
      ],
    },
  };
  const staged = stagePlugin(zipSync({ "holdall.plugin.json": strToU8(JSON.stringify(manifest)), "u.html": strToU8("x") }), { source: "third-party" });
  confirmInstall(staged.stageId, [], "alice");
  for (const user of ["alice", "bob"]) setPluginEnabledFor(user, "com.test.weather", true);
});

afterAll(async () => {
  await db.cleanup();
});

describe("plugin settings", () => {
  it("keeps personal settings per person, hides secrets from interface code and validates values", async () => {
    const { saveSettings, readSettings } = await import("./settings");
    const { callPluginApi } = await import("./api");
    saveSettings("com.test.weather", "alice", "global", { apiKey: "s3cret" });
    saveSettings("com.test.weather", "alice", "personal", { city: "Lisbon", units: "c", days: "3" });

    expect(readSettings("com.test.weather", "bob", { secrets: "hidden" })).toEqual({ apiKey: true, city: "Paris", units: null, days: null });
    expect(await callPluginApi("settings.get", {}, { pluginId: "com.test.weather", userId: "alice" })).toEqual({ apiKey: true, city: "Lisbon", units: "c", days: 3 });
    expect(await callPluginApi("settings.get", {}, { pluginId: "com.test.weather", userId: "alice", from: "server" })).toMatchObject({ apiKey: "s3cret" });

    const { getDb } = await import("@/core/db/client");
    const { pluginSetting } = await import("@/core/db/schema");
    expect(JSON.stringify(getDb().select().from(pluginSetting).all())).not.toContain("s3cret");

    expect(() => saveSettings("com.test.weather", "alice", "personal", { units: "k" })).toThrow(/Units/);
    expect(() => saveSettings("com.test.weather", "alice", "personal", { days: "9" })).toThrow(/Days/);
    saveSettings("com.test.weather", "alice", "global", {}, ["apiKey"]);
    expect(readSettings("com.test.weather", "alice", { secrets: "value" }).apiKey).toBeNull();
  });

  it("deletes personal settings with the account", async () => {
    const { readSettings, saveSettings } = await import("./settings");
    const { deleteAccount } = await import("@/core/auth/accounts");
    saveSettings("com.test.weather", "bob", "personal", { city: "Oslo" });
    deleteAccount("bob");
    expect(readSettings("com.test.weather", "bob", { secrets: "hidden" }).city).toBe("Paris");
  });
});
