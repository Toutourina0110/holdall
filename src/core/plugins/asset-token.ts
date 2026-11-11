import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/core/env";

const lifetimeMs = 12 * 60 * 60 * 1000;

function key(): Buffer {
  return Buffer.from(hkdfSync("sha256", getEnv().appSecret, "holdall", "holdall:plugin-assets:v1", 32));
}

function mac(pluginId: string, userId: string, expires: number): string {
  return createHmac("sha256", key()).update(`${pluginId}\n${userId}\n${expires}`).digest("base64url");
}

export function signAssetToken(pluginId: string, userId: string, now = Date.now()): string {
  const expires = now + lifetimeMs;
  return `${Buffer.from(`${userId}:${expires}`).toString("base64url")}.${mac(pluginId, userId, expires)}`;
}

export function verifyAssetToken(pluginId: string, token: string, now = Date.now()): string | undefined {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const [userId, expiresText] = Buffer.from(payload, "base64url").toString("utf8").split(":");
  const expires = Number(expiresText);
  if (!userId || !Number.isFinite(expires) || expires < now) return undefined;
  const expected = Buffer.from(mac(pluginId, userId, expires));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  return userId;
}
