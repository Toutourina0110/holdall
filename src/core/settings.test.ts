import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";
import { settingsError } from "./settings";

describe("settings", () => {
  it("refuses an invalid PORT", () => {
    expect(settingsError({ PORT: "abc" }, "/app")).toMatch(/PORT/);
  });

  it("refuses a mistyped HOLDALL_TARGET", () => {
    expect(settingsError({ HOLDALL_TARGET: "Desktop" }, "/app")).toMatch(/HOLDALL_TARGET/);
  });

  it("accepts valid settings", () => {
    expect(settingsError({ PORT: "3000", HOLDALL_TARGET: "server" }, "/app")).toBeUndefined();
  });

  it("resolves a relative DATA_DIR from the folder pnpm was run in, not the server folder", () => {
    const repo = path.resolve("/repo");
    const env = parseEnv({ DATA_DIR: "data", INIT_CWD: repo }, path.join(repo, ".next", "standalone"));
    expect(env.dataDir).toBe(path.join(repo, "data"));
  });
});
