import { randomBytes } from "node:crypto";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { decryptFromRelay, newDeliveryKey } from "@/core/security/relay-crypto";
import type { Credentials } from "./types";

type OAuthProvider = "google" | "microsoft";
type Pending = { userId: string; provider: OAuthProvider; key: string; expires: number };
type Tokens = { accessToken: string; refreshToken?: string; expiresIn: number };

const lifetime = 10 * 60 * 1000;
const perUser = 5;
const maxPending = 1000;
const storeKey = Symbol.for("holdall.oauthRelay");
const holder = globalThis as unknown as Record<symbol, Map<string, Pending> | undefined>;

function pendingStore(): Map<string, Pending> {
  holder[storeKey] ??= new Map();
  return holder[storeKey];
}

function validTokens(value: Tokens | undefined): value is Tokens {
  return Boolean(value) && typeof value!.accessToken === "string" && typeof value!.expiresIn === "number" && (value!.refreshToken === undefined || typeof value!.refreshToken === "string");
}

export function relayStartUrl(userId: string, provider: OAuthProvider, now = Date.now()): string | undefined {
  const env = getEnv();
  if (!env.oauthRelayUrl) return undefined;
  const store = pendingStore();
  for (const [state, entry] of store) if (entry.expires <= now) store.delete(state);
  const mine = [...store].filter(([, entry]) => entry.userId === userId).map(([state]) => state);
  for (const state of mine.slice(0, Math.max(0, mine.length - perUser + 1))) store.delete(state);
  while (store.size >= maxPending) store.delete(store.keys().next().value!);
  const state = randomBytes(24).toString("base64url");
  const key = newDeliveryKey();
  store.set(state, { userId, provider, key, expires: now + lifetime });
  const url = new URL(`${env.oauthRelayUrl}/relay/${provider}/start`);
  url.search = new URLSearchParams({ return: `${env.appUrl}/api/calendar/oauth/${provider}/callback`, state, key }).toString();
  return url.toString();
}

export function takePending(state: string, now = Date.now()): Pending | undefined {
  const store = pendingStore();
  const entry = store.get(state);
  if (!entry) return undefined;
  store.delete(state);
  return entry.expires > now ? entry : undefined;
}

export function relayCredentials(pending: Pending, payload: string, now = Date.now()): Credentials | undefined {
  const tokens = decryptFromRelay<Tokens>(pending.key, payload);
  if (!validTokens(tokens) || !tokens.refreshToken) return undefined;
  return { kind: "oauth", accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: now + tokens.expiresIn * 1000, via: "relay" };
}

export async function refreshThroughRelay(provider: OAuthProvider, refreshToken: string): Promise<Tokens> {
  const relay = getEnv().oauthRelayUrl;
  if (!relay) throw new UserFacingError("The sign-in relay is turned off on this Holdall. Connect the account again.");
  let response: Response;
  try {
    response = await fetch(`${relay}/relay/${provider}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Holdall" },
      body: JSON.stringify({ refreshToken }),
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new UserFacingError("The sign-in relay could not be reached. Sync tries again later.");
  }
  const data = (await response.json().catch(() => undefined)) as Tokens | undefined;
  if (response.status === 502) throw new UserFacingError("The calendar service refused the saved sign-in. Connect the account again.");
  if (!response.ok || !validTokens(data)) throw new UserFacingError(`The sign-in relay answered with an error (${response.status}). Sync tries again later.`);
  return data;
}
