import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";

const root = path.resolve(import.meta.dirname, "..");
const version = process.env.HOLDALL_NODE_VERSION ?? process.version;

function hostTriple() {
  const result = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
  const line = result.stdout?.split("\n").find((entry) => entry.startsWith("host:"));
  if (!line) throw new Error("rustc is needed to name the bundled Node binary. Install Rust, then try again.");
  return line.slice("host:".length).trim();
}

function nodeAsset(triple) {
  const arch = triple.startsWith("aarch64") ? "arm64" : "x64";
  if (triple.includes("windows")) return { name: `node-${version}-win-${arch}.zip`, inner: `node-${version}-win-${arch}/node.exe` };
  if (triple.includes("apple")) return { name: `node-${version}-darwin-${arch}.tar.gz`, inner: `node-${version}-darwin-${arch}/bin/node` };
  return { name: `node-${version}-linux-${arch}.tar.gz`, inner: `node-${version}-linux-${arch}/bin/node` };
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

const triple = hostTriple();
const asset = nodeAsset(triple);
const target = path.join(root, "src-tauri", "binaries", `node-${triple}${triple.includes("windows") ? ".exe" : ""}`);
if (fs.existsSync(target) && fs.existsSync(`${target}.version`) && fs.readFileSync(`${target}.version`, "utf8") === version) {
  process.stdout.write(`Node ${version} already bundled at ${target}\n`);
  process.exit(0);
}

const base = `https://nodejs.org/dist/${version}`;
const sums = (await download(`${base}/SHASUMS256.txt`)).toString("utf8");
const expected = sums
  .split("\n")
  .find((line) => line.trim().endsWith(`  ${asset.name}`))
  ?.split(/\s+/)[0];
if (!expected) throw new Error(`${asset.name} is not listed in SHASUMS256.txt for ${version}.`);
const archive = await download(`${base}/${asset.name}`);
const actual = createHash("sha256").update(archive).digest("hex");
if (actual !== expected) throw new Error(`Checksum mismatch for ${asset.name}.`);

fs.mkdirSync(path.dirname(target), { recursive: true });
if (asset.name.endsWith(".zip")) {
  const files = unzipSync(archive, { filter: (file) => file.name === asset.inner });
  const binary = files[asset.inner];
  if (!binary) throw new Error(`${asset.inner} is missing from ${asset.name}.`);
  fs.writeFileSync(target, binary);
} else {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "holdall-node-"));
  const file = path.join(work, asset.name);
  fs.writeFileSync(file, archive);
  const result = spawnSync("tar", ["-xzf", file, "-C", work, asset.inner], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("tar could not extract the Node archive.");
  fs.copyFileSync(path.join(work, asset.inner), target);
  fs.chmodSync(target, 0o755);
  fs.rmSync(work, { recursive: true, force: true });
}
fs.writeFileSync(`${target}.version`, version);
process.stdout.write(`Node ${version} verified and bundled at ${target}\n`);
