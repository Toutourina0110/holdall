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
