import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [version, asset, destination] = process.argv.slice(2);
if (!version || !asset || !destination) {
  process.stderr.write("Usage: node scripts/fetch-ytdlp.mjs <version> <asset> <destination>\n");
  process.exit(2);
}

const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}`;

async function download(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

const sums = (await download(`${base}/SHA2-256SUMS`)).toString("utf8");
const line = sums.split("\n").find((entry) => entry.trim().endsWith(` ${asset}`));
if (!line) throw new Error(`${asset} is not listed in SHA2-256SUMS for ${version}.`);
const expected = line.trim().split(/\s+/)[0].toLowerCase();
const binary = await download(`${base}/${asset}`);
const actual = createHash("sha256").update(binary).digest("hex");
if (actual !== expected) throw new Error(`Checksum mismatch for ${asset}: expected ${expected}, got ${actual}.`);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, binary, { mode: 0o755 });
process.stdout.write(`yt-dlp ${version} verified (${actual})\n`);
