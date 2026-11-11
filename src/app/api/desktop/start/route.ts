import { desktopSignIn } from "@/core/auth/desktop";
import { getEnv } from "@/core/env";
import { desktopGate, launchCookie } from "@/core/security/desktop-gate";
import { isDesktop } from "@/core/target";

export const dynamic = "force-dynamic";

function allowed(request: Request): boolean {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${launchCookie}=`))
    ?.slice(launchCookie.length + 1);
  return (
    desktopGate({
      token: process.env.HOLDALL_LAUNCH_TOKEN,
      port: Number(process.env.PORT ?? 3000),
      host: request.headers.get("host") ?? undefined,
      cookieToken: cookie,
      queryToken: new URL(request.url).searchParams.get("launch") ?? undefined,
    }) !== "deny"
  );
}

export async function GET(request: Request) {
  if (!isDesktop() || !allowed(request)) return new Response("Not found", { status: 404 });
  const base = getEnv().appUrl;
  const headers = await desktopSignIn().catch(() => undefined);
  const response = Response.redirect(new URL(headers ? "/" : "/login", base), 302);
  const redirect = new Response(null, { status: 302, headers: response.headers });
  for (const cookie of headers?.getSetCookie() ?? []) redirect.headers.append("Set-Cookie", cookie);
  return redirect;
}
