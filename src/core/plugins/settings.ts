import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { decrypt, encrypt } from "@/core/crypto";
import { getDb } from "@/core/db/client";
import { pluginSetting } from "@/core/db/schema";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import type { SettingField } from "./manifest";
import { getInstalledPlugin } from "./store";

export type SettingValue = string | number | boolean | null;

function ownerFor(field: SettingField, userId: string): string {
  return field.scope === "global" ? "global" : `user:${userId}`;
}

export function settingFields(pluginId: string): SettingField[] {
  return getInstalledPlugin(pluginId)?.manifest.contributes.settings ?? [];
}

export function readSettings(pluginId: string, userId: string, options: { secrets: "value" | "hidden" }): Record<string, SettingValue> {
  const fields = settingFields(pluginId);
  if (fields.length === 0) return {};
  const rows = getDb()
    .select()
    .from(pluginSetting)
    .where(and(eq(pluginSetting.pluginId, pluginId), inArray(pluginSetting.owner, ["global", `user:${userId}`])))
    .all();
  const result: Record<string, SettingValue> = {};
  for (const field of fields) {
    const row = rows.find((entry) => entry.key === field.key && entry.owner === ownerFor(field, userId));
    if (field.type === "secret") {
      result[field.key] = row ? (options.secrets === "value" ? decrypt(row.value, getEnv().appSecret) : true) : null;
      continue;
    }
    result[field.key] = row ? (JSON.parse(row.value) as SettingValue) : (field.default ?? null);
  }
  return result;
}

function parseValue(field: SettingField, raw: unknown): SettingValue {
  const fail = (message: string): never => {
    throw new UserFacingError(`${field.label}: ${message}`);
  };
  if (field.type === "boolean") return raw === true || raw === "true" || raw === "on";
  const text = typeof raw === "string" ? raw.trim() : raw === undefined || raw === null ? "" : String(raw);
  if (text === "") {
    if (field.required) fail("this field is required.");
    return null;
  }
  switch (field.type) {
    case "number": {
      const value = Number(text);
      if (!Number.isFinite(value)) fail("enter a number.");
      if (field.min !== undefined && value < field.min) fail(`use ${field.min} or more.`);
      if (field.max !== undefined && value > field.max) fail(`use ${field.max} or less.`);
      return value;
    }
    case "select":
      if (!field.options?.some((option) => option.value === text)) fail("choose one of the options.");
      return text;
    case "url":
      if (!z.url({ protocol: /^https?$/ }).safeParse(text).success) fail("enter a full http or https address.");
      return text;
    case "textarea":
      if (text.length > 20000) fail("use 20,000 characters or fewer.");
      return text;
    default:
      if (text.length > 2000) fail("use 2,000 characters or fewer.");
      return text;
  }
}

export function saveSettings(pluginId: string, userId: string, scope: "global" | "personal", input: Record<string, unknown>, clear: string[] = []): void {
  const fields = settingFields(pluginId).filter((field) => field.scope === scope);
  const db = getDb();
  const writes: { key: string; owner: string; value: string | null }[] = [];
  for (const field of fields) {
    const owner = ownerFor(field, userId);
    if (field.type === "secret") {
      if (clear.includes(field.key)) {
        if (field.required) throw new UserFacingError(`${field.label}: this field is required.`);
        writes.push({ key: field.key, owner, value: null });
        continue;
      }
      const text = typeof input[field.key] === "string" ? (input[field.key] as string).trim() : "";
      if (!text) continue;
      if (text.length > 2000) throw new UserFacingError(`${field.label}: use 2,000 characters or fewer.`);
      writes.push({ key: field.key, owner, value: encrypt(text, getEnv().appSecret) });
      continue;
    }
    const value = parseValue(field, input[field.key]);
    writes.push({ key: field.key, owner, value: value === null ? null : JSON.stringify(value) });
  }
  db.transaction((tx) => {
    for (const write of writes) {
      const where = and(eq(pluginSetting.pluginId, pluginId), eq(pluginSetting.owner, write.owner), eq(pluginSetting.key, write.key));
      if (write.value === null) tx.delete(pluginSetting).where(where).run();
      else
        tx.insert(pluginSetting)
          .values({ pluginId, owner: write.owner, key: write.key, value: write.value })
          .onConflictDoUpdate({ target: [pluginSetting.pluginId, pluginSetting.owner, pluginSetting.key], set: { value: write.value } })
          .run();
    }
  });
}

export function deleteUserSettings(userId: string): void {
  getDb().delete(pluginSetting).where(eq(pluginSetting.owner, `user:${userId}`)).run();
}
