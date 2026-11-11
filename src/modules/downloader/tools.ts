import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { safeFetch } from "@/core/security/safe-fetch";
import { isDesktop } from "@/core/target";

type ToolState = { ytdlp?: string; ffmpeg?: string; checkedAt?: string };

const exe = process.platform === "win32" ? ".exe" : "";

function binDir(): string {
  return path.join(getEnv().dataDir, "bin");
}

function stateFile(): string {
  return path.join(binDir(), "versions.json");
}

export function readToolState(): ToolState {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8")) as ToolState;
  } catch {
    return {};
  }
}

function writeToolState(change: Partial<ToolState>): void {
  fs.mkdirSync(binDir(), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify({ ...readToolState(), ...change }, null, 2));
}

function onPath(name: string): string | undefined {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [name], { encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.split(/\r?\n/)[0]?.trim() || undefined : undefined;
}

export function ytdlpPath(): string | undefined {
  const configured = process.env.YTDLP_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  const local = path.join(binDir(), `yt-dlp${exe}`);
  if (fs.existsSync(local)) return local;
  return onPath("yt-dlp");
}

export function ffmpegPath(): string | undefined {
  const configured = process.env.FFMPEG_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  const local = path.join(binDir(), `ffmpeg${exe}`);
  if (fs.existsSync(local)) return local;
  return onPath("ffmpeg");
}

export function toolVersion(binary: string | undefined, args: string[]): string | undefined {
  if (!binary) return undefined;
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 15000, windowsHide: true });
  return result.status === 0 ? result.stdout.split(/\r?\n/)[0]?.trim() : undefined;
}

export function canManageTools(): boolean {
  return isDesktop() && !process.env.YTDLP_PATH;
}

function ytdlpAsset(): string {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
}

function sha256(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function checksumFor(sums: string, asset: string): string | undefined {
  for (const line of sums.split(/\r?\n/)) {
    const [hash, name] = line.trim().split(/\s+\*?/);
    if (hash && name === asset && /^[0-9a-f]{64}$/i.test(hash)) return hash.toLowerCase();
  }
  return undefined;
}

export function verified(data: Buffer | Uint8Array, expected: string | undefined, asset: string): void {
  if (!expected) throw new UserFacingError(`${asset} has no published checksum. Nothing was installed.`);
  if (sha256(data) !== expected) throw new UserFacingError(`${asset} does not match its published checksum. Nothing was installed.`);
}

async function latestTag(repo: string): Promise<string> {
  const response = await safeFetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { "User-Agent": "holdall", Accept: "application/vnd.github+json" },
    maxBytes: 2 * 1024 * 1024,
  });
  if (response.status !== 200) throw new UserFacingError("GitHub could not be reached to check for updates. Try again later.");
  const tag = (JSON.parse(response.body.toString("utf8")) as { tag_name?: string }).tag_name;
  if (!tag || !/^[\w.-]{1,60}$/.test(tag)) throw new UserFacingError("GitHub returned an unexpected release name.");
  return tag;
}

async function fetchAsset(repo: string, tag: string, asset: string, maxBytes: number): Promise<Buffer> {
  const response = await safeFetch(`https://github.com/${repo}/releases/download/${tag}/${asset}`, {
    headers: { "User-Agent": "holdall" },
    maxBytes,
    timeoutMs: 10 * 60 * 1000,
    redirects: 5,
  });
  if (response.status !== 200) throw new UserFacingError(`${asset} could not be downloaded (status ${response.status}).`);
  return response.body;
}

function install(name: string, data: Buffer | Uint8Array): void {
  fs.mkdirSync(binDir(), { recursive: true });
  const target = path.join(binDir(), name);
  const temp = `${target}.download`;
  fs.writeFileSync(temp, data, { mode: 0o755 });
  fs.renameSync(temp, target);
}

export async function updateYtdlp(): Promise<string> {
  if (!canManageTools()) throw new UserFacingError("yt-dlp is managed by the Docker image on this server. Update the image instead.");
  const tag = await latestTag("yt-dlp/yt-dlp");
  if (readToolState().ytdlp === tag && ytdlpPath()) {
    writeToolState({ checkedAt: new Date().toISOString() });
    return tag;
  }
  const asset = ytdlpAsset();
  const sums = (await fetchAsset("yt-dlp/yt-dlp", tag, "SHA2-256SUMS", 1024 * 1024)).toString("utf8");
  const binary = await fetchAsset("yt-dlp/yt-dlp", tag, asset, 80 * 1024 * 1024);
  verified(binary, checksumFor(sums, asset), asset);
  install(`yt-dlp${exe}`, binary);
  writeToolState({ ytdlp: tag, checkedAt: new Date().toISOString() });
  return tag;
}

export async function installFfmpeg(): Promise<string> {
  if (!canManageTools()) throw new UserFacingError("ffmpeg is provided by the Docker image on this server.");
  if (process.platform !== "win32") {
    throw new UserFacingError("Install ffmpeg with your system package manager (for example brew install ffmpeg or apt install ffmpeg), then restart Holdall.");
  }
  const repo = "yt-dlp/FFmpeg-Builds";
  const tag = "latest";
  const asset = process.arch === "arm64" ? "ffmpeg-master-latest-winarm64-gpl.zip" : "ffmpeg-master-latest-win64-gpl.zip";
  const sums = (await fetchAsset(repo, tag, "checksums.sha256", 1024 * 1024)).toString("utf8");
  const archive = await fetchAsset(repo, tag, asset, 400 * 1024 * 1024);
  verified(archive, checksumFor(sums, asset), asset);
  const files = unzipSync(archive, { filter: (file) => /\/bin\/(ffmpeg|ffprobe)\.exe$/.test(file.name) });
  let installed = 0;
  for (const [name, data] of Object.entries(files)) {
    install(path.posix.basename(name), data);
    installed += 1;
  }
  if (installed === 0) throw new UserFacingError("The ffmpeg archive did not contain ffmpeg.exe.");
  writeToolState({ ffmpeg: asset });
  return asset;
}

export function updateIsDue(): boolean {
  const checkedAt = readToolState().checkedAt;
  return !checkedAt || Date.now() - new Date(checkedAt).getTime() > 24 * 60 * 60 * 1000;
}
