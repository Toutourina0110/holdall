import fs from "node:fs";
import path from "node:path";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { userPath } from "@/core/paths";

const reserved = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

export function cleanFolder(folder: string): string {
  const parts = folder
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 5) throw new UserFacingError("Folders can be nested 5 levels deep at most.");
  for (const part of parts) {
    if (part === "." || part === ".." || part.startsWith(".")) throw new UserFacingError("Folder names cannot start with a dot.");
    if (!/^[\p{L}\p{N} _()&,'-]{1,60}$/u.test(part) || reserved.test(part)) {
      throw new UserFacingError("Use letters, numbers, spaces, dashes and underscores in folder names (60 characters at most).");
    }
  }
  return parts.join("/");
}

export function baseFileName(title: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+|[.\s]+$/g, "")
    .slice(0, 80)
    .trim();
  const name = cleaned || "Untitled";
  return reserved.test(name) ? `${name} note` : name;
}

export function notesRoot(userId: string): string {
  return userPath(getEnv().dataDir, "notes", userId);
}

export function notePath(userId: string, folder: string, fileName: string): string {
  return userPath(getEnv().dataDir, "notes", userId, ...(folder ? folder.split("/") : []), `${fileName}.md`);
}

export function trashPath(userId: string, id: string): string {
  return userPath(getEnv().dataDir, "notes", userId, ".trash", `${id}.md`);
}

export function writeAtomic(file: string, content: string): fs.Stats {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, file);
  return fs.statSync(file);
}

export function readNoteFile(file: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

export function moveFile(from: string, to: string): void {
  if (from === to) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(from)) fs.renameSync(from, to);
}

export function removeEmptyFolders(userId: string, folder: string): void {
  const root = notesRoot(userId);
  let current = folder;
  while (current) {
    const dir = path.join(root, ...current.split("/"));
    try {
      if (fs.readdirSync(dir).length > 0) return;
      fs.rmdirSync(dir);
    } catch {
      return;
    }
    current = current.split("/").slice(0, -1).join("/");
  }
}
