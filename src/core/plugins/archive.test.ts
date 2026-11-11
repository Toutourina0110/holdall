import fs from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { sha256, unpackPlugin } from "./archive";
import { manifestSchema, satisfies } from "./manifest";
import { hookCatalog, permissionCatalog } from "./permissions";
import { parseRegistry } from "./registry";
import { hooks, permissions } from "../../../packages/plugin-sdk/src/index";

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

describe("plugin store index", () => {
  const entry = {
    id: "com.example.hello",
    name: "Hello",
    version: "1.0.0",
    type: "extension",
    author: { name: "Example" },
    archive: "https://example.com/hello.zip",
    sha256: "a".repeat(64),
    official: true,
  };

  it("marks entries official only when they come from the official registry", () => {
    expect(parseRegistry({ version: 1, plugins: [entry] }, true)[0]!.source).toBe("official");
    expect(parseRegistry({ version: 1, plugins: [entry] }, false)[0]!.source).toBe("third-party");
  });

  it("skips entries without an https archive or a valid checksum", () => {
    const bad = [{ ...entry, id: "com.example.http", archive: "http://example.com/a.zip" }, { ...entry, id: "com.example.sum", sha256: "nope" }];
    expect(parseRegistry({ version: 1, plugins: [...bad, entry] }, true).map((item) => item.id)).toEqual(["com.example.hello"]);
  });
});

describe("plugin SDK", () => {
  it("lists the same permissions and hooks as Holdall", () => {
    expect([...permissions].sort()).toEqual(Object.keys(permissionCatalog).sort());
    expect([...hooks].sort()).toEqual(Object.keys(hookCatalog).sort());
  });
});

describe("example plugins", () => {
  const root = path.join(process.cwd(), "examples", "plugins");
  it.each(fs.readdirSync(root))("%s installs", (name) => {
    const files: Record<string, Uint8Array> = {};
    const walk = (dir: string, prefix: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const key = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(full, key);
        else files[key] = new Uint8Array(fs.readFileSync(full));
      }
    };
    walk(path.join(root, name), "");
    expect(unpackPlugin(zipSync(files)).manifest.id).toContain(name);
  });
});
