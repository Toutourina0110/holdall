import { desktopSignIn } from "@/core/auth/desktop";
import { getEnv } from "@/core/env";
import { isDesktop } from "@/core/target";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDesktop()) return new Response("Not found", { status: 404 });
  const base = getEnv().appUrl;
  const headers = await desktopSignIn().catch(() => undefined);
  const response = Response.redirect(new URL(headers ? "/" : "/login", base), 302);
  const redirect = new Response(null, { status: 302, headers: response.headers });
  for (const cookie of headers?.getSetCookie() ?? []) redirect.headers.append("Set-Cookie", cookie);
  return redirect;
}
