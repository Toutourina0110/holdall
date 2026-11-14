import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ivLength = 12;
const tagLength = 16;

function encryptRaw(key: Buffer, plaintext: string): string {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

function decryptRaw(key: Buffer, payload: string): string | undefined {
  try {
    const raw = Buffer.from(payload, "base64url");
    if (raw.length < ivLength + tagLength) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, ivLength));
    decipher.setAuthTag(raw.subarray(ivLength, ivLength + tagLength));
    return Buffer.concat([decipher.update(raw.subarray(ivLength + tagLength)), decipher.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}

function sealKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "holdall", "holdall:relay-seal:v1", 32));
}

export function seal(secret: string, value: object, lifetimeMs: number, now = Date.now()): string {
  return encryptRaw(sealKey(secret), JSON.stringify({ value, expires: now + lifetimeMs }));
}

export function unseal<T>(secret: string, sealed: string, now = Date.now()): T | undefined {
  const text = decryptRaw(sealKey(secret), sealed);
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as { value: T; expires: number };
    return typeof parsed.expires === "number" && parsed.expires > now ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}

export function newDeliveryKey(): string {
  return randomBytes(32).toString("base64url");
}

export function isDeliveryKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value, "base64url").length === 32;
}

export function encryptForInstance(key: string, value: object): string {
  return encryptRaw(Buffer.from(key, "base64url"), JSON.stringify(value));
}

export function decryptFromRelay<T>(key: string, payload: string): T | undefined {
  const text = decryptRaw(Buffer.from(key, "base64url"), payload);
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}
