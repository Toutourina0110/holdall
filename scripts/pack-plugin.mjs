import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";

const source = process.argv[2];
if (!source || !fs.existsSync(path.join(source, "holdall.plugin.json"))) {
  process.stderr.write("Usage: node scripts/pack-plugin.mjs <plugin folder>. The folder must contain holdall.plugin.json.\n");
  process.exit(1);
}

function collect(dir, prefix, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) collect(full, name, files);
    else if (entry.isFile()) files[name] = new Uint8Array(fs.readFileSync(full));
  }
  return files;
}

const manifest = JSON.parse(fs.readFileSync(path.join(source, "holdall.plugin.json"), "utf8"));
const archive = zipSync(collect(source, "", {}), { level: 9, mtime: new Date("2026-01-01T00:00:00Z") });
const target = path.resolve(process.argv[3] ?? "dist-plugins", `${manifest.id}-${manifest.version}.zip`);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, archive);
const sha256 = createHash("sha256").update(archive).digest("hex");
process.stdout.write(`${JSON.stringify({ file: target, id: manifest.id, version: manifest.version, sha256 }, null, 2)}\n`);
