import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { createLogger } from "../src/core/log/index.ts";
import { proxiedClientIp, type ProxyHeader } from "../src/core/security/client-ip.ts";
import { encryptForInstance, isDeliveryKey, seal, unseal } from "../src/core/security/relay-crypto.ts";

type Provider = "google" | "microsoft";

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  extra: Record<string, string>;
  label: string;
};

type Ticket = { provider: Provider; returnUrl: string; state: string; key: string };
type Flight = Ticket & { verifier: string };

const log = createLogger("relay");
const ticketLifetime = 10 * 60 * 1000;
const windowMs = 10 * 60 * 1000;
const browserLimit = 30;
const refreshLimit = 600;

export type RelaySettings = {
  publicUrl: string;
  secret: string;
  trustProxy: boolean;
  proxyHeader: ProxyHeader;
  providers: Partial<Record<Provider, ProviderConfig>>;
  tokenFetch?: typeof fetch;
};

export function relaySettings(env: Record<string, string | undefined>): RelaySettings {
  const publicUrl = (env.RELAY_PUBLIC_URL ?? "").replace(/\/+$/, "");
  if (!/^https:\/\/[^/]+$/.test(publicUrl) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(publicUrl)) {
    throw new Error("Set RELAY_PUBLIC_URL to the https address of the relay, like https://auth.holdall.site.");
  }
  const secret = env.RELAY_SECRET ?? "";
  if (secret.length < 32) throw new Error("Set RELAY_SECRET to a random string of at least 32 characters.");
  const providers: RelaySettings["providers"] = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/calendar",
      extra: { access_type: "offline", prompt: "consent" },
      label: "Google Calendar",
    };
  }
  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
    const tenant = encodeURIComponent(env.MICROSOFT_TENANT_ID || "common");
    providers.microsoft = {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      scope: "offline_access Calendars.ReadWrite User.Read",
      extra: {},
      label: "Outlook",
    };
  }
  const header = env.TRUST_PROXY_HEADER;
  return {
    publicUrl,
    secret,
    trustProxy: env.TRUST_PROXY === "true" || env.TRUST_PROXY === "1",
    proxyHeader: header === "cf-connecting-ip" || header === "x-real-ip" || header === "x-forwarded-for" ? header : "auto",
    providers,
  };
}

export function checkReturnUrl(value: string, provider: Provider): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !local) return undefined;
  if (url.username || url.password || url.search || url.hash) return undefined;
  if (url.pathname !== `/api/calendar/oauth/${provider}/callback`) return undefined;
  return url.toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

const pageHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{color-scheme:light dark}body{margin:0;padding:24px;font:16px/1.5 system-ui,sans-serif;background:Canvas;color:CanvasText}main{max-width:32rem;margin:10vh auto}h1{font-size:1.4rem}.host{font-family:ui-monospace,monospace;font-weight:700;word-break:break-all}a.button{display:inline-block;margin:8px 8px 0 0;padding:10px 16px;border:1px solid;border-radius:7px;color:LinkText;text-decoration:none;font-weight:600}</style></head><body><main>${body}</main></body></html>`;
}

function redirect(res: http.ServerResponse, location: string): void {
  res.writeHead(303, { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  res.end();
}

function backTo(returnUrl: string, state: string, extra: Record<string, string>): string {
  const url = new URL(returnUrl);
  url.search = new URLSearchParams({ state, ...extra }).toString();
  return url.toString();
}

function readBody(req: http.IncomingMessage, limit: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    req.on("end", () => resolve(size > limit ? undefined : Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(undefined));
  });
}

async function tokenRequest(settings: RelaySettings, config: ProviderConfig, form: Record<string, string>) {
  const response = await (settings.tokenFetch ?? fetch)(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...form }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token || typeof data.expires_in !== "number") {
    throw new Error(`The provider refused the request (${response.status} ${data.error ?? ""}).`);
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export function createRelay(settings: RelaySettings): http.Server {
  const hits = new Map<string, number[]>();

  function allowed(address: string, bucket: string, limit: number): boolean {
    const now = Date.now();
    const key = `${bucket}:${address}`;
    if (hits.size > 20000) {
      for (const [name, times] of hits) if (times.every((time) => now - time >= windowMs)) hits.delete(name);
    }
    const times = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (times.length >= limit) return false;
    times.push(now);
    hits.set(key, times);
    return true;
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", settings.publicUrl);
    const read = (name: string) => {
      const value = req.headers[name];
      return Array.isArray(value) ? value.join(",") : value;
    };
    const address = (settings.trustProxy ? proxiedClientIp(read, settings.proxyHeader) : undefined) ?? req.socket.remoteAddress ?? "";
    const match = url.pathname.match(/^\/relay\/(google|microsoft)\/(start|go|callback|refresh)$/);

    if (url.pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", providers: Object.keys(settings.providers) }));
      return;
    }
    if (!match) {
      res.writeHead(404, pageHeaders);
      res.end(page("Holdall relay", "<h1>Holdall sign-in relay</h1><p>This service only helps Holdall connect calendars. See https://holdall.site/docs/install/oauth-relay/</p>"));
      return;
    }
    const provider = match[1] as Provider;
    const step = match[2]!;
    const config = settings.providers[provider];
    if (!config) {
      res.writeHead(404, pageHeaders);
      res.end(page("Not available", "<h1>Not available</h1><p>This relay is not set up for this provider.</p>"));
      return;
    }

    if (step === "refresh") {
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST" });
        res.end();
        return;
      }
      if (!allowed(address, "refresh", refreshLimit)) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Too many requests. Try again later." }));
        return;
      }
      const text = await readBody(req, 8192);
      if (text === undefined) {
        res.writeHead(413, { "Content-Type": "application/json", Connection: "close" });
        res.end(JSON.stringify({ error: "The request is too large." }));
        return;
      }
      let refreshToken: unknown;
      try {
        refreshToken = (JSON.parse(text) as { refreshToken?: unknown }).refreshToken;
      } catch {
        refreshToken = undefined;
      }
      if (typeof refreshToken !== "string" || refreshToken.length < 10 || refreshToken.length > 4096) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Send a refreshToken." }));
        return;
      }
      try {
        const tokens = await tokenRequest(settings, config, {
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          ...(provider === "microsoft" ? { scope: config.scope } : {}),
        });
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(tokens));
      } catch (error) {
        log.warn("Refresh failed", { provider, error: error instanceof Error ? error.message : String(error) });
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "The provider refused to refresh the access. Connect the account again." }));
      }
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405, { Allow: "GET" });
      res.end();
      return;
    }
    if (!allowed(address, "browser", browserLimit)) {
      res.writeHead(429, pageHeaders);
      res.end(page("Too many requests", "<h1>Too many requests</h1><p>Wait a few minutes, then try again from Holdall.</p>"));
      return;
    }

    if (step === "start") {
      const state = url.searchParams.get("state") ?? "";
      const key = url.searchParams.get("key") ?? "";
      const returnUrl = checkReturnUrl(url.searchParams.get("return") ?? "", provider);
      if (!returnUrl || !/^[A-Za-z0-9_-]{16,128}$/.test(state) || !isDeliveryKey(key)) {
        res.writeHead(400, pageHeaders);
        res.end(page("Invalid request", "<h1>This link is not valid</h1><p>Start again from the Calendar accounts page of your Holdall.</p>"));
        return;
      }
      const ticket = seal(settings.secret, { provider, returnUrl, state, key } satisfies Ticket, ticketLifetime);
      const host = new URL(returnUrl).host;
      const go = `${settings.publicUrl}/relay/${provider}/go?t=${encodeURIComponent(ticket)}`;
      res.writeHead(200, pageHeaders);
      res.end(
        page(
          `Connect ${config.label}`,
          `<h1>Connect ${escapeHtml(config.label)} to Holdall</h1><p>Your calendar will be connected to the Holdall at:</p><p class="host">${escapeHtml(host)}</p><p>Continue only if this is your own Holdall, or one you trust. That Holdall will be able to read and change your calendar.</p><a class="button" href="${escapeHtml(go)}">Continue to ${escapeHtml(config.label)}</a>`,
        ),
      );
      return;
    }

    if (step === "go") {
      const ticket = unseal<Ticket>(settings.secret, url.searchParams.get("t") ?? "");
      if (!ticket || ticket.provider !== provider) {
        res.writeHead(400, pageHeaders);
        res.end(page("Link expired", "<h1>This link has expired</h1><p>Start again from the Calendar accounts page of your Holdall.</p>"));
        return;
      }
      const verifier = randomBytes(48).toString("base64url");
      const flight = seal(settings.secret, { ...ticket, verifier } satisfies Flight, ticketLifetime);
      const authorize = new URL(config.authorizeUrl);
      authorize.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: `${settings.publicUrl}/relay/${provider}/callback`,
        response_type: "code",
        scope: config.scope,
        state: flight,
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
        code_challenge_method: "S256",
        ...config.extra,
      }).toString();
      redirect(res, authorize.toString());
      return;
    }

    const flight = unseal<Flight>(settings.secret, url.searchParams.get("state") ?? "");
    if (!flight || flight.provider !== provider) {
      res.writeHead(400, pageHeaders);
      res.end(page("Link expired", "<h1>This sign-in has expired</h1><p>Start again from the Calendar accounts page of your Holdall.</p>"));
      return;
    }
    const code = url.searchParams.get("code");
    if (!code) {
      redirect(res, backTo(flight.returnUrl, flight.state, { error: "denied" }));
      return;
    }
    try {
      const tokens = await tokenRequest(settings, config, {
        grant_type: "authorization_code",
        code,
        code_verifier: flight.verifier,
        redirect_uri: `${settings.publicUrl}/relay/${provider}/callback`,
      });
      if (!tokens.refreshToken) {
        redirect(res, backTo(flight.returnUrl, flight.state, { error: "offline" }));
        return;
      }
      redirect(res, backTo(flight.returnUrl, flight.state, { relay: encryptForInstance(flight.key, tokens) }));
    } catch (error) {
      log.warn("Code exchange failed", { provider, error: error instanceof Error ? error.message : String(error) });
      redirect(res, backTo(flight.returnUrl, flight.state, { error: "exchange" }));
    }
  });
}

if (import.meta.main || process.argv[1]?.endsWith("relay.mjs")) {
  const settings = relaySettings(process.env);
  const port = Number(process.env.PORT ?? 3000);
  createRelay(settings).listen(port, "0.0.0.0", () => {
    log.info("Holdall relay ready", { port, providers: Object.keys(settings.providers), publicUrl: settings.publicUrl });
  });
}
