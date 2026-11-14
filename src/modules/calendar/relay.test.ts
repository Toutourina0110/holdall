import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encryptForInstance } from "@/core/security/relay-crypto";
import { insertUser, useTempDatabase } from "@/test/db";

const signedIn = vi.hoisted(() => ({ userId: "alice" }));

vi.mock("@/core/auth/session", () => ({
  apiSession: async () => ({ user: { id: signedIn.userId } }),
  unauthorized: () => Response.json({ error: "Sign in to continue." }, { status: 401 }),
}));
vi.mock("@/modules/calendar/sync", () => ({ requestSync: () => undefined }));

let db: Awaited<ReturnType<typeof useTempDatabase>>;

beforeAll(async () => {
  vi.stubEnv("APP_URL", "https://holdall.example.com");
  vi.stubEnv("OAUTH_RELAY_URL", "https://auth.example.com");
  db = await useTempDatabase("relay");
  await insertUser("alice");
  await insertUser("bob");
});

afterAll(async () => {
  await db.cleanup();
});

async function startAs(userId: string) {
  const { relayStartUrl } = await import("./relay");
  const url = new URL(relayStartUrl(userId, "google")!);
  return { state: url.searchParams.get("state")!, key: url.searchParams.get("key")!, url };
}

async function callback(query: Record<string, string>) {
  const { GET } = await import("@/app/api/calendar/oauth/[provider]/callback/route");
  const request = new Request(`https://holdall.example.com/api/calendar/oauth/google/callback?${new URLSearchParams(query)}`);
  const response = await GET(request, { params: Promise.resolve({ provider: "google" }) });
  return new URL(response.headers.get("location")!).search;
}

const tokens = { accessToken: "access-1", refreshToken: "refresh-1", expiresIn: 3600 };

describe("calendar sign-in through the relay", () => {
  it("sends the right return address to the relay", async () => {
    const { url } = await startAs("alice");
    expect(url.origin + url.pathname).toBe("https://auth.example.com/relay/google/start");
    expect(url.searchParams.get("return")).toBe("https://holdall.example.com/api/calendar/oauth/google/callback");
  });

  it("adds the account to the user who started, only once", async () => {
    signedIn.userId = "alice";
    const { state, key } = await startAs("alice");
    const relay = encryptForInstance(key, tokens);
    expect(await callback({ state, relay })).toBe("?connected=1");
    expect(await callback({ state, relay })).toBe("?error=state");
    const { listAccounts, accountCredentials } = await import("./store");
    const account = listAccounts("alice").find((item) => item.provider === "google")!;
    expect(accountCredentials("alice", account.id)).toMatchObject({ kind: "oauth", refreshToken: "refresh-1", via: "relay" });
    expect(listAccounts("bob").filter((item) => item.provider === "google")).toHaveLength(0);
  });

  it("refuses a sign-in finished by another user", async () => {
    const { state, key } = await startAs("alice");
    signedIn.userId = "bob";
    expect(await callback({ state, relay: encryptForInstance(key, tokens) })).toBe("?error=state");
    const { listAccounts } = await import("./store");
    expect(listAccounts("bob").filter((item) => item.provider === "google")).toHaveLength(0);
  });

  it("refuses tokens not encrypted with the key of this sign-in", async () => {
    signedIn.userId = "alice";
    const { state } = await startAs("alice");
    const other = await startAs("alice");
    expect(await callback({ state, relay: encryptForInstance(other.key, tokens) })).toBe("?error=exchange");
  });
});
