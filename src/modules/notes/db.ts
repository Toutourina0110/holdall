import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "@/core/db/auth-schema";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const note = sqliteTable(
  "note",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    folder: text("folder").notNull().default(""),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    trashedAt: integer("trashed_at", { mode: "timestamp_ms" }),
    size: integer("size").notNull().default(0),
    fileMtime: integer("file_mtime").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("note_user_idx").on(table.userId), uniqueIndex("note_file_idx").on(table.userId, table.folder, table.fileName)],
);

export const noteTag = sqliteTable(
  "note_tag",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => note.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => [primaryKey({ columns: [table.noteId, table.tag] }), index("note_tag_user_idx").on(table.userId, table.tag)],
);

export const noteLink = sqliteTable(
  "note_link",
  {
    fromId: text("from_id")
      .notNull()
      .references(() => note.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    target: text("target").notNull(),
  },
  (table) => [primaryKey({ columns: [table.fromId, table.target] }), index("note_link_target_idx").on(table.userId, table.target)],
);

export const noteVersion = sqliteTable(
  "note_version",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => note.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("note_version_note_idx").on(table.noteId)],
);
