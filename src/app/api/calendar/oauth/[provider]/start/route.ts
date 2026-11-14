import { createHash, randomBytes } from "node:crypto";
import { apiSession, unauthorized } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { canConnect, oauthConfig, redirectUri, type OAuthProvider } from "@/modules/calendar/providers";
import { relayStartUrl } from "@/modules/calendar/relay";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const provider = (await params).provider;
  if (provider !== "google" && provider !== "microsoft") return Response.json({ error: "Unknown provider." }, { status: 404 });
  const notConfigured = () => Response.redirect(new URL("/calendar/accounts?error=not-configured", getEnv().appUrl), 302);
  if (!canConnect(provider as OAuthProvider)) return notConfigured();
  const config = oauthConfig(provider as OAuthProvider);
  if (!config) {
    const relay = relayStartUrl(session.user.id, provider as OAuthProvider);
    return relay ? new Response(null, { status: 302, headers: { Location: relay, "Cache-Control": "no-store" } }) : notConfigured();
  }
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(provider as OAuthProvider),
    response_type: "code",
    scope: config.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...config.extra,
  }).toString();
  const secure = getEnv().appUrl.startsWith("https://");
  const cookie = `holdall_oauth=${state}.${verifier}.${session.user.id}; Path=/api/calendar/oauth; HttpOnly; SameSite=Lax; Max-Age=600${secure ? "; Secure" : ""}`;
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Set-Cookie": cookie } });
}
