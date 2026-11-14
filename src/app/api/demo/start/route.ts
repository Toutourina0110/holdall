import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { clientIpOf } from "@/core/security/client-ip";
import { startDemoSession } from "@/modules/demo/demo";

export const dynamic = "force-dynamic";

function go(path: string, cookies: string[] = []) {
  const response = new Response(null, { status: 303, headers: { Location: new URL(path, getEnv().appUrl).toString() } });
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.demoMode) return new Response("Not found", { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env.appUrl).origin) return new Response("Forbidden", { status: 403 });
  try {
    const headers = await startDemoSession(clientIpOf(request.headers, { trustProxy: env.trustProxy, header: env.trustProxyHeader }));
    return go("/", headers.getSetCookie());
  } catch (error) {
    const text = error instanceof UserFacingError ? error.message : "";
    return go(`/demo?error=${text.startsWith("Too many") ? "limit" : text.includes("full") ? "full" : "failed"}`);
  }
}
