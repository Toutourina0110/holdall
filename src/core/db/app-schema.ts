import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const appSetting = sqliteTable("app_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const userLayout = sqliteTable("user_layout", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  layout: text("layout").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const userTheme = sqliteTable("user_theme", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["system", "light", "dark", "custom"] }).notNull().default("system"),
  theme: text("theme"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const plugin = sqliteTable("plugin", {
  id: text("id").primaryKey(),
  version: text("version").notNull(),
  manifest: text("manifest").notNull(),
  source: text("source", { enum: ["builtin", "official", "third-party"] }).notNull(),
  sha256: text("sha256"),
  installedBy: text("installed_by").references(() => user.id, { onDelete: "set null" }),
  installedAt: createdAt(),
});

export const pluginPermission = sqliteTable(
  "plugin_permission",
  {
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugin.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    granted: integer("granted", { mode: "boolean" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.pluginId, table.permission] })],
);

export const userPlugin = sqliteTable(
  "user_plugin",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugin.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.pluginId] })],
);

export const job = sqliteTable(
  "job",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    status: text("status", { enum: ["queued", "running", "done", "failed", "cancelled"] }).notNull(),
    progress: real("progress").notNull().default(0),
    message: text("message"),
    result: text("result"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    createdAt: createdAt(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("job_user_idx").on(table.userId), index("job_status_idx").on(table.status)],
);

export const pluginStorage = sqliteTable(
  "plugin_storage",
  {
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugin.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (table) => [primaryKey({ columns: [table.pluginId, table.userId, table.key] })],
);
