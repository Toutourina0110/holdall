import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "@/core/db/auth-schema";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const calendarAccount = sqliteTable(
  "calendar_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["local", "google", "microsoft", "icloud", "caldav"] }).notNull(),
    name: text("name").notNull(),
    credentials: text("credentials"),
    status: text("status", { enum: ["ok", "error", "syncing"] }).notNull().default("ok"),
    error: text("error"),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("calendar_account_user_idx").on(table.userId)],
);

export const calendar = sqliteTable(
  "calendar",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => calendarAccount.id, { onDelete: "cascade" }),
    remoteId: text("remote_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#1f4a7a"),
    readOnly: integer("read_only", { mode: "boolean" }).notNull().default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [index("calendar_user_idx").on(table.userId), uniqueIndex("calendar_remote_idx").on(table.accountId, table.remoteId)],
);

export const calendarEvent = sqliteTable(
  "calendar_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendar.id, { onDelete: "cascade" }),
    remoteId: text("remote_id"),
    etag: text("etag"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    location: text("location").notNull().default(""),
    start: integer("start", { mode: "timestamp_ms" }).notNull(),
    end: integer("end", { mode: "timestamp_ms" }).notNull(),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    recurring: integer("recurring", { mode: "boolean" }).notNull().default(false),
    dirty: integer("dirty", { mode: "boolean" }).notNull().default(false),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
    remoteUpdatedAt: integer("remote_updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("calendar_event_range_idx").on(table.userId, table.start),
    index("calendar_event_calendar_idx").on(table.calendarId),
  ],
);

export const calendarHistory = sqliteTable(
  "calendar_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: text("event_id"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [index("calendar_history_user_idx").on(table.userId)],
);
