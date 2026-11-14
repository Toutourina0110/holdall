import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");

function copy(from, to) {
  if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true });
}

const keep = new Set([".next", "node_modules", "package.json", "server.js"]);
for (const entry of fs.readdirSync(standalone)) {
  if (!keep.has(entry)) fs.rmSync(path.join(standalone, entry), { recursive: true, force: true });
}

function replaceLinks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(full);
      fs.rmSync(full, { recursive: true, force: true });
      fs.cpSync(real, full, { recursive: true, dereference: true });
    } else if (entry.isDirectory()) {
      replaceLinks(full);
    }
  }
}

replaceLinks(standalone);

const musl = process.platform === "linux" && !process.report?.getReport().header.glibcVersionRuntime;
const nativeName = `${process.platform}${musl ? "musl" : ""}-${process.arch}.node`;

function keepOnlyOwnPrebuilds(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === "prebuilds") {
      const files = fs.readdirSync(full);
      if (!files.includes(nativeName)) continue;
      for (const file of files) if (file !== nativeName) fs.rmSync(path.join(full, file), { recursive: true, force: true });
    } else {
      keepOnlyOwnPrebuilds(full);
    }
  }
}

keepOnlyOwnPrebuilds(standalone);

copy(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copy(path.join(root, "public"), path.join(standalone, "public"));
copy(path.join(root, "drizzle"), path.join(standalone, "drizzle"));
fs.mkdirSync(path.join(standalone, "scripts"), { recursive: true });
fs.copyFileSync(path.join(root, "scripts", "plugin-runner.mjs"), path.join(standalone, "scripts", "plugin-runner.mjs"));

await build({
  entryPoints: [path.join(root, "scripts", "start.ts")],
  outfile: path.join(standalone, "start.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["better-sqlite3"],
  banner: { js: "import { createRequire as __holdallRequire } from 'node:module'; const require = __holdallRequire(import.meta.url);" },
  logLevel: "warning",
});

await build({
  entryPoints: [path.join(root, "scripts", "relay.ts")],
  outfile: path.join(standalone, "relay.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "warning",
});
