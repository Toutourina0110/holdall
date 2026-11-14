import { createHash } from "node:crypto";
import type http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decryptFromRelay, newDeliveryKey, seal, unseal } from "../src/core/security/relay-crypto.ts";
import { checkReturnUrl, createRelay, relaySettings } from "./relay.ts";

const secret = "relay-test-secret-that-is-long-enough-1234";
const instanceReturn = "https://holdall.example.com/api/calendar/oauth/google/callback";

let server: http.Server;
let base: string;
const tokenCalls: URLSearchParams[] = [];

beforeAll(async () => {
  const settings = relaySettings({
    RELAY_PUBLIC_URL: "http://127.0.0.1:1",
    RELAY_SECRET: secret,
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "client-secret",
  });
  settings.tokenFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const form = new URLSearchParams(String(init?.body));
    tokenCalls.push(form);
    if (form.get("code") === "bad" || form.get("refresh_token") === "revoked-token") return Response.json({ error: "invalid_grant" }, { status: 400 });
    return Response.json({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600 });
  }) as typeof fetch;
  server = createRelay(settings);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

function get(path: string, cookie?: string) {
  return fetch(`${base}${path}`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
}

describe("relay crypto", () => {
  it("refuses tampered, expired or foreign sealed values", () => {
    const sealed = seal(secret, { a: 1 }, 1000, 0);
    expect(unseal(secret, sealed, 500)).toEqual({ a: 1 });
    expect(unseal(secret, sealed, 1500)).toBeUndefined();
    expect(unseal("another-secret-that-is-long-enough-12345", sealed, 500)).toBeUndefined();
    const raw = Buffer.from(sealed, "base64url");
    raw[raw.length - 1] = raw[raw.length - 1]! ^ 1;
    expect(unseal(secret, raw.toString("base64url"), 500)).toBeUndefined();
  });
});

describe("return address", () => {
  it("only accepts the Holdall callback over https, or http on this computer", () => {
    expect(checkReturnUrl(instanceReturn, "google")).toBe(instanceReturn);
    expect(checkReturnUrl("http://127.0.0.1:4000/api/calendar/oauth/google/callback", "google")).toBeDefined();
    expect(checkReturnUrl("http://holdall.example.com/api/calendar/oauth/google/callback", "google")).toBeUndefined();
    expect(checkReturnUrl("https://holdall.example.com/api/calendar/oauth/microsoft/callback", "google")).toBeUndefined();
    expect(checkReturnUrl("https://holdall.example.com/steal", "google")).toBeUndefined();
    expect(checkReturnUrl("https://user:pass@holdall.example.com/api/calendar/oauth/google/callback", "google")).toBeUndefined();
    expect(checkReturnUrl(`${instanceReturn}?x=1`, "google")).toBeUndefined();
    expect(checkReturnUrl("javascript:alert(1)", "google")).toBeUndefined();
  });
});

describe("relay flow", () => {
  it("delivers tokens only encrypted for the instance that asked", async () => {
    const key = newDeliveryKey();
    const state = "state-0123456789abcdef";
    const start = await get(`/relay/google/start?${new URLSearchParams({ return: instanceReturn, state, key })}`);
    expect(start.status).toBe(200);
    const html = await start.text();
    expect(html).toContain("holdall.example.com");
    expect(start.headers.get("x-frame-options")).toBe("DENY");
    const go = html.match(/href="([^"]+)"/)![1]!.replace(/&amp;/g, "&").replace("http://127.0.0.1:1", base);
    const cookie = start.headers.get("set-cookie")!.split(";")[0]!;
    expect(start.headers.get("set-cookie")).toContain("HttpOnly");

    expect((await get(go.slice(base.length))).status).toBe(400);
    expect((await get(go.slice(base.length), "holdall_relay=someone-else")).status).toBe(400);
    const authorize = await get(go.slice(base.length), cookie);
    expect(authorize.status).toBe(303);
    const provider = new URL(authorize.headers.get("location")!);
    expect(provider.origin).toBe("https://accounts.google.com");
    expect(provider.searchParams.get("code_challenge_method")).toBe("S256");
    expect(provider.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:1/relay/google/callback");

    const callbackPath = `/relay/google/callback?${new URLSearchParams({ code: "good", state: provider.searchParams.get("state")! })}`;
    expect((await get(callbackPath)).status).toBe(400);
    const callback = await get(callbackPath, cookie);
    expect(callback.status).toBe(303);
    const back = new URL(callback.headers.get("location")!);
    expect(back.origin + back.pathname).toBe(instanceReturn);
    expect(back.searchParams.get("state")).toBe(state);
    const payload = back.searchParams.get("relay")!;
    expect(payload).not.toContain("access-1");
    expect(decryptFromRelay(key, payload)).toEqual({ accessToken: "access-1", refreshToken: "refresh-1", expiresIn: 3600 });
    expect(decryptFromRelay(newDeliveryKey(), payload)).toBeUndefined();
    expect(tokenCalls.at(-1)?.get("code_verifier")).toBeTruthy();
  });

  it("rejects bad links, forged states and failed exchanges", async () => {
    const key = newDeliveryKey();
    expect((await get(`/relay/google/start?${new URLSearchParams({ return: "https://evil.example/x", state: "state-0123456789abcdef", key })}`)).status).toBe(400);
    expect((await get(`/relay/google/start?${new URLSearchParams({ return: instanceReturn, state: "state-0123456789abcdef", key: "short" })}`)).status).toBe(400);
    expect((await get("/relay/google/go?t=forged")).status).toBe(400);
    expect((await get("/relay/google/callback?code=good&state=forged")).status).toBe(400);
    expect((await get("/relay/microsoft/start")).status).toBe(404);

    const browser = createHash("sha256").update("mark").digest("base64url");
    const flight = seal(secret, { provider: "google", returnUrl: instanceReturn, state: "state-0123456789abcdef", key, verifier: "v", browser }, 60000);
    const failed = await get(`/relay/google/callback?code=bad&state=${encodeURIComponent(flight)}`, "holdall_relay=mark");
    expect(new URL(failed.headers.get("location")!).searchParams.get("error")).toBe("exchange");
  });

  it("refreshes access and refuses oversized or empty bodies", async () => {
    const post = (body: string) => fetch(`${base}/relay/google/refresh`, { method: "POST", body, headers: { "Content-Type": "application/json" } });
    const ok = await post(JSON.stringify({ refreshToken: "refresh-token-1" }));
    expect(await ok.json()).toEqual({ accessToken: "access-1", refreshToken: "refresh-1", expiresIn: 3600 });
    expect((await post(JSON.stringify({ refreshToken: "revoked-token" }))).status).toBe(502);
    expect((await post("{}")).status).toBe(400);
    expect((await post(JSON.stringify({ refreshToken: "x".repeat(10000) }))).status).toBe(413);
  });
});
