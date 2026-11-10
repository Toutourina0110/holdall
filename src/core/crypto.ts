import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const version = "v1";
const ivLength = 12;
const tagLength = 16;

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "holdall", "holdall:encryption:v1", 32));
}

export function encrypt(plaintext: string, secret: string): string {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${Buffer.concat([iv, tag, body]).toString("base64url")}`;
}

export function decrypt(payload: string, secret: string): string {
  const [prefix, data] = payload.split(":");
  if (prefix !== version || !data) throw new Error("Encrypted value has an unknown format.");
  const raw = Buffer.from(data, "base64url");
  const iv = raw.subarray(0, ivLength);
  const tag = raw.subarray(ivLength, ivLength + tagLength);
  const body = raw.subarray(ivLength + tagLength);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
