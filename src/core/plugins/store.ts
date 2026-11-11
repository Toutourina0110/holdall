import { getEnv } from "@/core/env";
import { isUnsafePermission } from "./permissions";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { plugin, pluginPermission, pluginStorage, userPlugin } from "@/core/db/schema";
import { manifestSchema, type PluginManifest } from "./manifest";

export type InstalledPlugin = {
  id: string;
  version: string;
  source: "builtin" | "official" | "third-party";
  manifest: PluginManifest;
  granted: Set<string>;
};

function grantsFor(pluginId: string): Set<string> {
  const rows = getDb().select().from(pluginPermission).where(eq(pluginPermission.pluginId, pluginId)).all();
  return new Set(rows.filter((row) => row.granted).map((row) => row.permission));
}

function toInstalled(row: typeof plugin.$inferSelect): InstalledPlugin | undefined {
  const parsed = manifestSchema.safeParse(JSON.parse(row.manifest));
  if (!parsed.success) return undefined;
  return { id: row.id, version: row.version, source: row.source, manifest: parsed.data, granted: grantsFor(row.id) };
}

export function listInstalledPlugins(): InstalledPlugin[] {
  return getDb()
    .select()
    .from(plugin)
    .all()
    .map(toInstalled)
    .filter((item): item is InstalledPlugin => Boolean(item));
}

export function getInstalledPlugin(id: string): InstalledPlugin | undefined {
  const row = getDb().select().from(plugin).where(eq(plugin.id, id)).get();
  return row ? toInstalled(row) : undefined;
}

export function isPluginEnabledFor(userId: string, pluginId: string): boolean {
  const row = getDb()
    .select()
    .from(userPlugin)
    .where(and(eq(userPlugin.userId, userId), eq(userPlugin.pluginId, pluginId)))
    .get();
  return row?.enabled ?? false;
}

export function setPluginEnabledFor(userId: string, pluginId: string, enabled: boolean): void {
  if (!getInstalledPlugin(pluginId)) throw new Error("This plugin is not installed.");
  getDb()
    .insert(userPlugin)
    .values({ userId, pluginId, enabled })
    .onConflictDoUpdate({ target: [userPlugin.userId, userPlugin.pluginId], set: { enabled } })
    .run();
}

export function isPluginActiveFor(userId: string, pluginId: string): boolean {
  if (isPluginEnabledFor(userId, pluginId)) return true;
  if (getInstalledPlugin(pluginId)?.manifest.type !== "library") return false;
  return pluginsEnabledFor(userId).some((item) => pluginId in item.manifest.dependencies);
}

export function dependentsOf(pluginId: string): string[] {
  return listInstalledPlugins()
    .filter((item) => pluginId in item.manifest.dependencies)
    .map((item) => item.manifest.name);
}

export function usersWithPlugin(pluginId: string): string[] {
  return getDb()
    .select({ userId: userPlugin.userId })
    .from(userPlugin)
    .where(and(eq(userPlugin.pluginId, pluginId), eq(userPlugin.enabled, true)))
    .all()
    .map((row) => row.userId);
}

export function pluginsEnabledFor(userId: string): InstalledPlugin[] {
  return listInstalledPlugins().filter((item) => isPluginEnabledFor(userId, item.id));
}

export function setPluginPermission(pluginId: string, permission: string, granted: boolean): void {
  const installed = getInstalledPlugin(pluginId);
  if (!installed) throw new Error("This plugin is not installed.");
  if (!installed.manifest.optionalPermissions.includes(permission)) {
    throw new Error("Only optional permissions can be changed. Uninstall the plugin to remove a required one.");
  }
  if (granted && isUnsafePermission(permission) && !getEnv().allowUnsafePlugins) {
    throw new Error("This permission can harm the server and is turned off here. Set ALLOW_UNSAFE_PLUGINS=true to allow it.");
  }
  getDb()
    .insert(pluginPermission)
    .values({ pluginId, permission, granted })
    .onConflictDoUpdate({ target: [pluginPermission.pluginId, pluginPermission.permission], set: { granted } })
    .run();
}

export function readPluginStorage(pluginId: string, userId: string, key: string): unknown {
  const row = getDb()
    .select()
    .from(pluginStorage)
    .where(and(eq(pluginStorage.pluginId, pluginId), eq(pluginStorage.userId, userId), eq(pluginStorage.key, key)))
    .get();
  return row ? (JSON.parse(row.value) as unknown) : null;
}

export function writePluginStorage(pluginId: string, userId: string, key: string, value: unknown): void {
  const json = JSON.stringify(value ?? null);
  if (json.length > 256 * 1024) throw new Error("Plugin storage values are limited to 256 KB.");
  getDb()
    .insert(pluginStorage)
    .values({ pluginId, userId, key, value: json })
    .onConflictDoUpdate({ target: [pluginStorage.pluginId, pluginStorage.userId, pluginStorage.key], set: { value: json } })
    .run();
}

export function deletePluginStorage(pluginId: string, userId: string, key: string): void {
  getDb()
    .delete(pluginStorage)
    .where(and(eq(pluginStorage.pluginId, pluginId), eq(pluginStorage.userId, userId), eq(pluginStorage.key, key)))
    .run();
}
