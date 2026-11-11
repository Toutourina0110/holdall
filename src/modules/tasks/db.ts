import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "@/core/db/auth-schema";
import { note } from "@/modules/notes/db";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const taskList = sqliteTable(
  "task_list",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("task_list_user_idx").on(table.userId)],
);

export const task = sqliteTable(
  "task",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listId: text("list_id").references(() => taskList.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    dueDate: text("due_date"),
    dueTime: text("due_time"),
    priority: integer("priority").notNull().default(0),
    labels: text("labels").notNull().default("[]"),
    position: integer("position").notNull().default(0),
    noteId: text("note_id").references(() => note.id, { onDelete: "set null" }),
    noteItem: text("note_item"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("task_user_idx").on(table.userId), index("task_due_idx").on(table.userId, table.dueDate)],
);
