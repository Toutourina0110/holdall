import { timingSafeEqual } from "node:crypto";
import { apiSession, unauthorized } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { createLogger } from "@/core/log";
import { strings } from "@/core/strings";
import { isDesktop } from "@/core/target";
import { exchangeCode, type OAuthProvider } from "@/modules/calendar/providers";
import { relayCredentials, takePending } from "@/modules/calendar/relay";
import { addAccount } from "@/modules/calendar/store";
import { requestSync } from "@/modules/calendar/sync";
import type { Credentials } from "@/modules/calendar/types";

const log = createLogger("calendar");

function back(query: string) {
  if (isDesktop()) {
    const t = strings.calendarAccounts;
    const text = query === "connected=1" ? t.desktopConnected : t.desktopFailed;
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>Holdall</title></head><body><p>${text}</p></body></html>`, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(`/calendar/accounts?${query}`, getEnv().appUrl).toString(), "Set-Cookie": "holdall_oauth=; Path=/api/calendar/oauth; Max-Age=0" },
  });
}

function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function connect(userId: string, provider: OAuthProvider, credentials: Credentials) {
  const account = addAccount(userId, { provider, name: provider === "google" ? "Google Calendar" : "Outlook", credentials });
  requestSync(userId, account.id);
  return back("connected=1");
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider;
  if (provider !== "google" && provider !== "microsoft") return Response.json({ error: "Unknown provider." }, { status: 404 });
  const url = new URL(request.url);
  const given = url.searchParams.get("state") ?? "";

  const pending = takePending(given);
  if (pending) {
    if (pending.provider !== provider) return back("error=state");
    if (!isDesktop()) {
      const session = await apiSession(request);
      if (!session || session.user.id !== pending.userId) return back("error=state");
    }
    const failure = url.searchParams.get("error");
    if (failure) return back(`error=${failure === "denied" || failure === "offline" ? failure : "exchange"}`);
    const credentials = relayCredentials(pending, url.searchParams.get("relay") ?? "");
    if (!credentials) return back("error=exchange");
    return connect(pending.userId, provider, credentials);
  }

  const session = await apiSession(request);
  if (!session) return isDesktop() ? back("error=state") : unauthorized();
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("holdall_oauth="))?.slice("holdall_oauth=".length);
  const [state, verifier, userId] = (cookie ?? "").split(".");
  if (!state || !verifier || userId !== session.user.id || !same(state, given)) return back("error=state");
  const code = url.searchParams.get("code");
  if (!code) return back("error=denied");
  try {
    return connect(session.user.id, provider, await exchangeCode(provider, code, verifier));
  } catch (error) {
    log.warn("Calendar sign-in failed", { provider, error: error instanceof Error ? error.message : String(error) });
    return back("error=exchange");
  }
}
