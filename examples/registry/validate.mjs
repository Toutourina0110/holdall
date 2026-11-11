import { createHash } from "node:crypto";
import fs from "node:fs";

const file = process.argv[2] ?? "index.json";
const problems = [];
const index = JSON.parse(fs.readFileSync(file, "utf8"));

if (index.version !== 1) problems.push("index.json: version must be 1.");
if (!Array.isArray(index.plugins)) problems.push("index.json: plugins must be a list.");

const seen = new Set();
for (const [position, entry] of (index.plugins ?? []).entries()) {
  const where = `plugins[${position}] ${entry?.id ?? ""}`.trim();
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(entry?.id ?? "")) problems.push(`${where}: id must be a reverse domain name in lower case.`);
  if (seen.has(entry?.id)) problems.push(`${where}: this id is listed twice.`);
  seen.add(entry?.id);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(entry?.version ?? "")) problems.push(`${where}: version must look like 1.2.0.`);
  if (!["module", "extension", "library", "theme"].includes(entry?.type)) problems.push(`${where}: type must be module, extension, library or theme.`);
  if (typeof entry?.name !== "string" || !entry.name.trim()) problems.push(`${where}: name is missing.`);
  if (typeof entry?.author?.name !== "string") problems.push(`${where}: author.name is missing.`);
  if (!/^[0-9a-f]{64}$/.test(entry?.sha256 ?? "")) problems.push(`${where}: sha256 must be 64 lower case hexadecimal characters.`);
  if (!String(entry?.archive ?? "").startsWith("https://")) {
    problems.push(`${where}: archive must be an https address.`);
    continue;
  }
  const response = await fetch(entry.archive, { redirect: "follow" });
  if (!response.ok) {
    problems.push(`${where}: the archive could not be downloaded (${response.status}).`);
    continue;
  }
  const digest = createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex");
  if (digest !== entry.sha256) problems.push(`${where}: the archive checksum is ${digest}, not the one listed.`);
}

if (problems.length) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`${seen.size} plugins checked.\n`);
