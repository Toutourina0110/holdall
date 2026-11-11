import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { UserFacingError } from "@/core/errors";
import { note, noteLink, noteTag, noteVersion } from "./db";
import { baseFileName, cleanFolder, moveFile, notePath, readNoteFile, removeEmptyFolders, trashPath, writeAtomic } from "./files";

export type NoteRow = typeof note.$inferSelect;
export type NoteSummary = NoteRow & { tags: string[] };
export type NoteDetail = NoteSummary & { content: string };

const maxContent = 5 * 1024 * 1024;
const versionGapMs = 10 * 60 * 1000;
const maxVersions = 50;

function own(userId: string, id: string): NoteRow {
  const row = getDb().select().from(note).where(and(eq(note.id, id), eq(note.userId, userId))).get();
  if (!row) throw new UserFacingError("This note does not exist or was deleted.");
  return row;
}

function tagsFor(userId: string, ids: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const rows = getDb().select().from(noteTag).where(and(eq(noteTag.userId, userId), inArray(noteTag.noteId, ids))).all();
  for (const row of rows) map.set(row.noteId, [...(map.get(row.noteId) ?? []), row.tag]);
  return map;
}

function uniqueFileName(userId: string, folder: string, title: string, exceptId?: string): string {
  const base = baseFileName(title);
  const db = getDb();
  for (let index = 1; index < 1000; index++) {
    const candidate = index === 1 ? base : `${base} ${index}`;
    const clash = db
      .select({ id: note.id })
      .from(note)
      .where(and(eq(note.userId, userId), eq(note.folder, folder), sql`lower(${note.fileName}) = lower(${candidate})`))
      .get();
    if (!clash || clash.id === exceptId) return candidate;
  }
  throw new UserFacingError("Too many notes have this title in this folder. Choose another title.");
}

export function extractLinks(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(/\[\[([^[\]\n|]{1,120})(?:\|[^[\]\n]*)?\]\]/g)) found.add(match[1]!.trim().toLowerCase());
  return [...found].filter(Boolean);
}

function indexNote(row: NoteRow, content: string): void {
  const db = getDb();
  db.run(sql`delete from note_fts where note_id = ${row.id}`);
  if (!row.trashedAt) db.run(sql`insert into note_fts (note_id, user_id, title, body) values (${row.id}, ${row.userId}, ${row.title}, ${content})`);
  db.delete(noteLink).where(eq(noteLink.fromId, row.id)).run();
  for (const target of extractLinks(content)) db.insert(noteLink).values({ fromId: row.id, userId: row.userId, target }).onConflictDoNothing().run();
}

function snapshot(row: NoteRow, content: string, force = false): void {
  const db = getDb();
  const last = db.select().from(noteVersion).where(eq(noteVersion.noteId, row.id)).orderBy(desc(noteVersion.createdAt)).get();
  if (last && last.content === content && last.title === row.title) return;
  if (!force && last && Date.now() - last.createdAt.getTime() < versionGapMs) return;
  db.insert(noteVersion).values({ id: randomUUID(), noteId: row.id, userId: row.userId, title: row.title, content, createdAt: new Date() }).run();
  const old = db
    .select({ id: noteVersion.id })
    .from(noteVersion)
    .where(eq(noteVersion.noteId, row.id))
    .orderBy(desc(noteVersion.createdAt))
    .all()
    .slice(maxVersions);
  if (old.length) db.delete(noteVersion).where(inArray(noteVersion.id, old.map((item) => item.id))).run();
}

function fileFor(row: NoteRow): string {
  return row.trashedAt ? trashPath(row.userId, row.id) : notePath(row.userId, row.folder, row.fileName);
}

export function listNotes(
  userId: string,
  filter: { folder?: string; tag?: string; trashed?: boolean; favorites?: boolean } = {},
): NoteSummary[] {
  const conditions = [eq(note.userId, userId), filter.trashed ? isNotNull(note.trashedAt) : isNull(note.trashedAt)];
  if (filter.folder !== undefined) conditions.push(eq(note.folder, filter.folder));
  if (filter.favorites) conditions.push(eq(note.favorite, true));
  if (filter.tag) {
    const tagged = getDb()
      .select({ id: noteTag.noteId })
      .from(noteTag)
      .where(and(eq(noteTag.userId, userId), eq(noteTag.tag, filter.tag.toLowerCase())))
      .all()
      .map((row) => row.id);
    if (tagged.length === 0) return [];
    conditions.push(inArray(note.id, tagged));
  }
  const rows = getDb()
    .select()
    .from(note)
    .where(and(...conditions))
    .orderBy(desc(note.pinned), desc(note.updatedAt))
    .all();
  const tags = tagsFor(userId, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, tags: tags.get(row.id) ?? [] }));
}

export function listFolders(userId: string): string[] {
  const rows = getDb()
    .selectDistinct({ folder: note.folder })
    .from(note)
    .where(and(eq(note.userId, userId), isNull(note.trashedAt), ne(note.folder, "")))
    .orderBy(asc(note.folder))
    .all();
  const all = new Set<string>();
  for (const { folder } of rows) {
    const parts = folder.split("/");
    for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join("/"));
  }
  return [...all].sort((a, b) => a.localeCompare(b));
}

export function listTags(userId: string): { tag: string; count: number }[] {
  return getDb()
    .select({ tag: noteTag.tag, count: sql<number>`count(*)` })
    .from(noteTag)
    .innerJoin(note, eq(note.id, noteTag.noteId))
    .where(and(eq(noteTag.userId, userId), isNull(note.trashedAt)))
    .groupBy(noteTag.tag)
    .orderBy(asc(noteTag.tag))
    .all();
}

export function getNote(userId: string, id: string): NoteDetail {
  let row = own(userId, id);
  const file = fileFor(row);
  const content = readNoteFile(file);
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    if (Math.round(stat.mtimeMs) !== row.fileMtime) {
      getDb().update(note).set({ fileMtime: Math.round(stat.mtimeMs), size: stat.size }).where(eq(note.id, id)).run();
      row = { ...row, fileMtime: Math.round(stat.mtimeMs), size: stat.size };
      indexNote(row, content);
    }
  }
  return { ...row, content, tags: tagsFor(userId, [id]).get(id) ?? [] };
}

export function createNote(userId: string, input: { title?: string; folder?: string; content?: string }): NoteDetail {
  const title = (input.title ?? "").trim().slice(0, 200) || "Untitled";
  const folder = cleanFolder(input.folder ?? "");
  const content = input.content ?? "";
  if (content.length > maxContent) throw new UserFacingError("Notes are limited to 5 MB.");
  const id = randomUUID();
  const fileName = uniqueFileName(userId, folder, title);
  const stat = writeAtomic(notePath(userId, folder, fileName), content);
  const now = new Date();
  const row: NoteRow = {
    id,
    userId,
    folder,
    title,
    fileName,
    pinned: false,
    favorite: false,
    trashedAt: null,
    size: stat.size,
    fileMtime: Math.round(stat.mtimeMs),
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(note).values(row).run();
  indexNote(row, content);
  return { ...row, content, tags: [] };
}

export function saveNote(userId: string, id: string, input: { title?: string; content?: string; folder?: string }): NoteDetail {
  const row = own(userId, id);
  if (row.trashedAt) throw new UserFacingError("Restore this note from the trash before editing it.");
  const previousContent = readNoteFile(fileFor(row));
  const content = input.content ?? previousContent;
  if (content.length > maxContent) throw new UserFacingError("Notes are limited to 5 MB.");
  const title = input.title === undefined ? row.title : input.title.trim().slice(0, 200) || "Untitled";
  const folder = input.folder === undefined ? row.folder : cleanFolder(input.folder);
  const fileName = title !== row.title || folder !== row.folder ? uniqueFileName(userId, folder, title, id) : row.fileName;
  if (content !== previousContent || title !== row.title) snapshot(row, previousContent);
  const from = notePath(userId, row.folder, row.fileName);
  const to = notePath(userId, folder, fileName);
  moveFile(from, to);
  const stat = writeAtomic(to, content);
  if (folder !== row.folder) removeEmptyFolders(userId, row.folder);
  const next: NoteRow = { ...row, title, folder, fileName, size: stat.size, fileMtime: Math.round(stat.mtimeMs), updatedAt: new Date() };
  getDb().update(note).set(next).where(eq(note.id, id)).run();
  indexNote(next, content);
  return { ...next, content, tags: tagsFor(userId, [id]).get(id) ?? [] };
}

export function setNoteFlags(userId: string, id: string, flags: { pinned?: boolean; favorite?: boolean }): void {
  own(userId, id);
  getDb().update(note).set(flags).where(eq(note.id, id)).run();
}

export function setNoteTags(userId: string, id: string, tags: string[]): string[] {
  own(userId, id);
  const clean = [...new Set(tags.map((tag) => tag.trim().toLowerCase().replace(/^#/, "")).filter((tag) => /^[\p{L}\p{N}_/-]{1,40}$/u.test(tag)))].slice(0, 30);
  const db = getDb();
  db.delete(noteTag).where(and(eq(noteTag.noteId, id), eq(noteTag.userId, userId))).run();
  for (const tag of clean) db.insert(noteTag).values({ noteId: id, userId, tag }).run();
  return clean;
}

export function trashNote(userId: string, id: string): void {
  const row = own(userId, id);
  if (row.trashedAt) return;
  moveFile(notePath(userId, row.folder, row.fileName), trashPath(userId, id));
  removeEmptyFolders(userId, row.folder);
  const next = { ...row, trashedAt: new Date() };
  getDb().update(note).set({ trashedAt: next.trashedAt }).where(eq(note.id, id)).run();
  indexNote(next, "");
}

export function restoreNote(userId: string, id: string): NoteDetail {
  const row = own(userId, id);
  if (!row.trashedAt) return getNote(userId, id);
  const fileName = uniqueFileName(userId, row.folder, row.title, id);
  moveFile(trashPath(userId, id), notePath(userId, row.folder, fileName));
  getDb().update(note).set({ trashedAt: null, fileName }).where(eq(note.id, id)).run();
  const restored = getNote(userId, id);
  indexNote(restored, restored.content);
  return restored;
}

export function deleteNoteForever(userId: string, id: string): void {
  const row = own(userId, id);
  if (!row.trashedAt) throw new UserFacingError("Move the note to the trash before deleting it for good.");
  fs.rmSync(trashPath(userId, id), { force: true });
  getDb().run(sql`delete from note_fts where note_id = ${id}`);
  getDb().delete(note).where(eq(note.id, id)).run();
}

export function emptyTrash(userId: string, olderThan?: Date): number {
  const conditions = [eq(note.userId, userId), isNotNull(note.trashedAt)];
  if (olderThan) conditions.push(lt(note.trashedAt, olderThan));
  const rows = getDb().select({ id: note.id }).from(note).where(and(...conditions)).all();
  for (const row of rows) deleteNoteForever(userId, row.id);
  return rows.length;
}

function ftsQuery(query: string): string | undefined {
  const words = query
    .toLowerCase()
    .match(/[\p{L}\p{N}_]+/gu)
    ?.slice(0, 10);
  if (!words?.length) return undefined;
  return words.map((word) => `"${word}"*`).join(" ");
}

export function searchNotes(userId: string, query: string): (NoteSummary & { snippet: string })[] {
  const match = ftsQuery(query);
  if (!match) return [];
  const hits = getDb().all<{ note_id: string; snippet: string }>(
    sql`select note_id, snippet(note_fts, 3, '[', ']', ' ... ', 12) as snippet from note_fts where note_fts match ${match} and user_id = ${userId} order by rank limit 50`,
  );
  if (hits.length === 0) return [];
  const rows = getDb()
    .select()
    .from(note)
    .where(and(eq(note.userId, userId), isNull(note.trashedAt), inArray(note.id, hits.map((hit) => hit.note_id))))
    .all();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const tags = tagsFor(userId, rows.map((row) => row.id));
  return hits
    .filter((hit) => byId.has(hit.note_id))
    .map((hit) => ({ ...byId.get(hit.note_id)!, tags: tags.get(hit.note_id) ?? [], snippet: hit.snippet }));
}

export function findNoteByTitle(userId: string, title: string): NoteRow | undefined {
  return getDb()
    .select()
    .from(note)
    .where(and(eq(note.userId, userId), isNull(note.trashedAt), sql`lower(${note.title}) = ${title.trim().toLowerCase()}`))
    .orderBy(desc(note.updatedAt))
    .get();
}

export function backlinks(userId: string, id: string): NoteRow[] {
  const row = own(userId, id);
  const sources = getDb()
    .select({ id: noteLink.fromId })
    .from(noteLink)
    .where(and(eq(noteLink.userId, userId), eq(noteLink.target, row.title.toLowerCase())))
    .all()
    .map((link) => link.id)
    .filter((source) => source !== id);
  if (sources.length === 0) return [];
  return getDb()
    .select()
    .from(note)
    .where(and(eq(note.userId, userId), isNull(note.trashedAt), inArray(note.id, sources)))
    .orderBy(desc(note.updatedAt))
    .all();
}

export function listVersions(userId: string, id: string) {
  own(userId, id);
  return getDb()
    .select({ id: noteVersion.id, title: noteVersion.title, createdAt: noteVersion.createdAt, size: sql<number>`length(${noteVersion.content})` })
    .from(noteVersion)
    .where(and(eq(noteVersion.noteId, id), eq(noteVersion.userId, userId)))
    .orderBy(desc(noteVersion.createdAt))
    .all();
}

export function getVersion(userId: string, noteId: string, versionId: string) {
  const version = getDb()
    .select()
    .from(noteVersion)
    .where(and(eq(noteVersion.id, versionId), eq(noteVersion.noteId, noteId), eq(noteVersion.userId, userId)))
    .get();
  if (!version) throw new UserFacingError("This version does not exist.");
  return version;
}

export function restoreVersion(userId: string, noteId: string, versionId: string): NoteDetail {
  const version = getVersion(userId, noteId, versionId);
  const row = own(userId, noteId);
  snapshot(row, readNoteFile(fileFor(row)), true);
  return saveNote(userId, noteId, { title: version.title, content: version.content });
}

export function exportFiles(userId: string, folder?: string): { path: string; content: string }[] {
  const prefix = folder ? cleanFolder(folder) : "";
  return listNotes(userId)
    .filter((row) => !prefix || row.folder === prefix || row.folder.startsWith(`${prefix}/`))
    .map((row) => ({
      path: `${prefix ? row.folder.slice(prefix.length).replace(/^\//, "") : row.folder}${row.folder !== prefix && row.folder ? "/" : ""}${row.fileName}.md`.replace(/^\//, ""),
      content: readNoteFile(notePath(userId, row.folder, row.fileName)),
    }));
}

export function importFiles(userId: string, folder: string, files: { path: string; content: string }[]): number {
  const base = cleanFolder(folder);
  let count = 0;
  for (const file of files.slice(0, 2000)) {
    const parts = file.path.replace(/\\/g, "/").split("/").filter(Boolean);
    const name = parts.pop();
    if (!name || !/\.(md|markdown|txt)$/i.test(name)) continue;
    if (parts.some((part) => part === ".." || part.startsWith("."))) throw new UserFacingError("The archive contains paths that leave its folder. Nothing more was imported.");
    const sub = cleanFolder([base, ...parts].filter(Boolean).join("/"));
    createNote(userId, { title: name.replace(/\.(md|markdown|txt)$/i, ""), folder: sub, content: file.content });
    count += 1;
  }
  return count;
}

export function checklistItems(content: string): { text: string; done: boolean }[] {
  const items: { text: string; done: boolean }[] = [];
  for (const match of content.matchAll(/^\s*[-*+]\s+\[( |x|X)\]\s+(.+)$/gm)) items.push({ done: match[1] !== " ", text: match[2]!.trim() });
  return items;
}
