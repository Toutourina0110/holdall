import { timingSafeEqual } from "node:crypto";
import { apiSession, unauthorized } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { createLogger } from "@/core/log";
import { exchangeCode, type OAuthProvider } from "@/modules/calendar/providers";
import { addAccount } from "@/modules/calendar/store";
import { requestSync } from "@/modules/calendar/sync";

const log = createLogger("calendar");

function back(query: string) {
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

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const provider = (await params).provider;
  if (provider !== "google" && provider !== "microsoft") return Response.json({ error: "Unknown provider." }, { status: 404 });
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("holdall_oauth="))?.slice("holdall_oauth=".length);
  const [state, verifier, userId] = (cookie ?? "").split(".");
  const given = url.searchParams.get("state") ?? "";
  if (!state || !verifier || userId !== session.user.id || !same(state, given)) return back("error=state");
  const code = url.searchParams.get("code");
  if (!code) return back("error=denied");
  try {
    const credentials = await exchangeCode(provider as OAuthProvider, code, verifier);
    const account = addAccount(session.user.id, { provider: provider as OAuthProvider, name: provider === "google" ? "Google Calendar" : "Outlook", credentials });
    requestSync(session.user.id, account.id);
    return back("connected=1");
  } catch (error) {
    log.warn("Calendar sign-in failed", { provider, error: error instanceof Error ? error.message : String(error) });
    return back("error=exchange");
  }
}
