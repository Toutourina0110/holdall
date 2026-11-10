import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { sha256, unpackPlugin } from "./archive";
import { manifestSchema, satisfies } from "./manifest";

const manifest = {
  id: "com.example.hello",
  name: "Hello",
  version: "1.0.0",
  type: "extension",
  author: { name: "Example" },
  license: "MIT",
  holdall: ">=0.0.1",
  permissions: ["ui:slots"],
  entry: { ui: "ui/index.html" },
};

function zip(files: Record<string, string>) {
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
}

describe("plugin archives", () => {
  it("unpacks a valid plugin", () => {
    const archive = zip({ "holdall.plugin.json": JSON.stringify(manifest), "ui/index.html": "<p>hi</p>" });
    const result = unpackPlugin(archive);
    expect(result.manifest.id).toBe("com.example.hello");
    expect(result.files.has("ui/index.html")).toBe(true);
  });

  it.each(["../evil.js", "ui/../../evil.js", "/etc/evil", "C:/evil.js"])("refuses an entry that escapes the plugin folder: %s", (name) => {
    const archive = zip({ "holdall.plugin.json": JSON.stringify(manifest), "ui/index.html": "x", [name]: "x" });
    expect(() => unpackPlugin(archive)).toThrow(/outside|absolute/);
  });

  it("refuses an archive whose checksum does not match", () => {
    const archive = zip({ "holdall.plugin.json": JSON.stringify(manifest), "ui/index.html": "x" });
    expect(() => unpackPlugin(archive, "0".repeat(64))).toThrow(/checksum/);
    expect(unpackPlugin(archive, sha256(archive)).manifest.id).toBe("com.example.hello");
  });

  it("refuses a manifest that points to a missing file", () => {
    const archive = zip({ "holdall.plugin.json": JSON.stringify(manifest) });
    expect(() => unpackPlugin(archive)).toThrow(/not in the archive/);
  });

  it("refuses garbage", () => {
    expect(() => unpackPlugin(strToU8("not a zip"))).toThrow(/not a valid plugin archive/);
  });
});

describe("plugin manifests", () => {
  it.each([
    [{ ...manifest, id: "Hello" }],
    [{ ...manifest, permissions: ["root:everything"] }],
    [{ ...manifest, network: ["api.example.com"] }],
    [{ ...manifest, entry: { ui: "../ui.html" } }],
    [{ ...manifest, contributes: { hooks: ["notes.saved"] } }],
    [{ ...manifest, type: "theme", theme: "theme.json", entry: { server: "dist/server.js" } }],
  ])("refuses an unsafe or inconsistent manifest %#", (input) => {
    expect(manifestSchema.safeParse(input).success).toBe(false);
  });

  it("checks Holdall version ranges", () => {
    expect(satisfies("0.3.2", ">=0.3.0")).toBe(true);
    expect(satisfies("0.2.9", ">=0.3.0")).toBe(false);
    expect(satisfies("1.4.0", "^1.2.0")).toBe(true);
    expect(satisfies("2.0.0", "^1.2.0")).toBe(false);
    expect(satisfies("0.3.5", "^0.3.0")).toBe(true);
    expect(satisfies("0.4.0", "^0.3.0")).toBe(false);
    expect(satisfies("0.3.0", "nonsense")).toBe(false);
  });
});
