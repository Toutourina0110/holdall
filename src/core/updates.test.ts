import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;

beforeAll(async () => {
  db = await useTempDatabase("updates");
});

afterAll(async () => {
  await db.cleanup();
});

describe("server updates", () => {
  it("only trusts published GitHub releases with a plain version", async () => {
    const { parseRelease } = await import("./updates");
    expect(parseRelease({ tag_name: "v0.3.0", html_url: "https://github.com/Toutourina0110/holdall/releases/tag/v0.3.0" })).toEqual({
      version: "0.3.0",
      url: "https://github.com/Toutourina0110/holdall/releases/tag/v0.3.0",
    });
    expect(parseRelease({ tag_name: "v0.3.0", html_url: "https://github.com/x", draft: true })).toBeUndefined();
    expect(parseRelease({ tag_name: "v0.3.0-beta.1", html_url: "https://github.com/x" })).toBeUndefined();
    expect(parseRelease({ tag_name: "v0.3.0", html_url: "javascript:alert(1)" })).toBeUndefined();
  });

  it("announces a release only when it is newer than the running version", async () => {
    const { getDb } = await import("@/core/db/client");
    const { appSetting } = await import("@/core/db/schema");
    const { availableUpdate } = await import("./updates");
    getDb()
      .insert(appSetting)
      .values({ key: "update.latest", value: JSON.stringify({ version: "0.10.0", url: "https://github.com/Toutourina0110/holdall/releases/tag/v0.10.0" }) })
      .run();
    expect(availableUpdate("0.9.5")?.version).toBe("0.10.0");
    expect(availableUpdate("0.10.0")).toBeUndefined();
    expect(availableUpdate("1.0.0")).toBeUndefined();
  });

  it("refuses to start an update without a webhook", async () => {
    const { triggerUpdate } = await import("./updates");
    await expect(triggerUpdate()).rejects.toThrow(/UPDATE_WEBHOOK_URL|update command/);
  });
});
