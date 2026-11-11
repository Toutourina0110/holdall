import fs from "node:fs";
import path from "node:path";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { userPath } from "@/core/paths";

export type Root = "files" | "downloads";
export const roots: Root[] = ["files", "downloads"];

export type Entry = { name: string; path: string; kind: "folder" | "file"; size: number; modified: string; type: FileType };
export type FileType = "folder" | "image" | "video" | "audio" | "pdf" | "text" | "other";

const extensions: Record<Exclude<FileType, "folder" | "other">, string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "tif", "tiff"],
  video: ["mp4", "webm", "mkv", "mov", "avi", "m4v"],
  audio: ["mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"],
  pdf: ["pdf"],
  text: ["txt", "md", "markdown", "json", "csv", "log", "xml", "yml", "yaml", "ini", "srt", "vtt"],
};

export function extensionOf(name: string): string {
  return path.extname(name).slice(1).toLowerCase();
}

export function fileType(name: string): FileType {
  const ext = extensionOf(name);
  for (const [type, list] of Object.entries(extensions)) if (list.includes(ext)) return type as FileType;
  return "other";
}

export function parseRoot(value: unknown): Root {
  if (value === "files" || value === "downloads") return value;
  throw new UserFacingError("Unknown folder.");
}

export function cleanRelative(value: string): string[] {
  const parts = value
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== ".");
  for (const part of parts) {
    if (part === ".." || part.startsWith(".")) throw new UserFacingError("This path is not allowed.");
  }
  return parts;
}

export function cleanName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 200) throw new UserFacingError("Use a name between 1 and 200 characters.");
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(name) || name.startsWith(".") || /[. ]$/.test(name) || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(name)) {
    throw new UserFacingError("This name has characters that files cannot use. Avoid < > : \" / \\ | ? * and a leading dot.");
  }
  return name;
}

export function resolve(userId: string, root: Root, relative: string): string {
  return userPath(getEnv().dataDir, root, userId, ...cleanRelative(relative));
}

export function rootDir(userId: string, root: Root): string {
  const dir = userPath(getEnv().dataDir, root, userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function relativeOf(userId: string, root: Root, full: string): string {
  return path.relative(rootDir(userId, root), full).split(path.sep).join("/");
}

export function listFolder(userId: string, root: Root, relative: string): Entry[] {
  rootDir(userId, root);
  const dir = resolve(userId, root, relative);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new UserFacingError("This folder does not exist.");
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && !entry.name.endsWith(".part") && !entry.isSymbolicLink())
    .map((entry) => {
      const full = path.join(dir, entry.name);
      const stat = fs.statSync(full);
      const folder = entry.isDirectory();
      return {
        name: entry.name,
        path: relativeOf(userId, root, full),
        kind: folder ? "folder" : "file",
        size: folder ? 0 : stat.size,
        modified: stat.mtime.toISOString(),
        type: folder ? "folder" : fileType(entry.name),
      } satisfies Entry;
    })
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
}

export function fileInfo(userId: string, root: Root, relative: string) {
  const full = resolve(userId, root, relative);
  if (!fs.existsSync(full)) throw new UserFacingError("This file does not exist anymore.");
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) throw new UserFacingError("Links are not supported.");
  return { full, stat, name: path.basename(full), type: stat.isDirectory() ? ("folder" as const) : fileType(full) };
}

export function makeFolder(userId: string, root: Root, parent: string, name: string): string {
  const full = path.join(resolve(userId, root, parent), cleanName(name));
  if (fs.existsSync(full)) throw new UserFacingError("Something with this name already exists here.");
  fs.mkdirSync(full, { recursive: true });
  return relativeOf(userId, root, full);
}

export function uniqueTarget(dir: string, name: string): string {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  for (let index = 1; index < 1000; index++) {
    const candidate = path.join(dir, index === 1 ? name : `${base} (${index})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new UserFacingError("Too many files have this name here. Rename one first.");
}

export function renameEntry(userId: string, root: Root, relative: string, name: string): string {
  const { full } = fileInfo(userId, root, relative);
  if (path.resolve(full) === rootDir(userId, root)) throw new UserFacingError("The main folder cannot be renamed.");
  const target = path.join(path.dirname(full), cleanName(name));
  if (target !== full && fs.existsSync(target)) throw new UserFacingError("Something with this name already exists here.");
  fs.renameSync(full, target);
  return relativeOf(userId, root, target);
}

export function moveEntry(userId: string, root: Root, relative: string, destination: string): string {
  const { full } = fileInfo(userId, root, relative);
  const folder = resolve(userId, root, destination);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new UserFacingError("The destination folder does not exist.");
  const inside = path.relative(full, folder);
  if (!inside.startsWith("..") && !path.isAbsolute(inside)) throw new UserFacingError("A folder cannot be moved into itself.");
  const target = uniqueTarget(folder, path.basename(full));
  fs.renameSync(full, target);
  return relativeOf(userId, root, target);
}

export function deleteEntry(userId: string, root: Root, relative: string): void {
  const { full } = fileInfo(userId, root, relative);
  if (path.resolve(full) === rootDir(userId, root)) throw new UserFacingError("The main folder cannot be deleted.");
  fs.rmSync(full, { recursive: true, force: true });
}

export function allFolders(userId: string, root: Root): string[] {
  const base = rootDir(userId, root);
  const out = [""];
  const walk = (dir: string, depth: number) => {
    if (depth > 6 || out.length > 500) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      out.push(path.relative(base, full).split(path.sep).join("/"));
      walk(full, depth + 1);
    }
  };
  walk(base, 0);
  return out;
}

export function allFiles(userId: string, root: Root, limit = 500): string[] {
  const base = rootDir(userId, root);
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 6) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= limit || entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (!entry.name.endsWith(".part")) out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  };
  walk(base, 0);
  return out;
}
