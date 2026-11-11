import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, staticSecurityHeaders } from "@/core/security/headers";
import { desktopGate, launchCookie } from "@/core/security/desktop-gate";
import { isPublicPath } from "@/core/security/public-routes";
import { isDesktop } from "@/core/target";

const crossOriginIsolatedPrefixes = ["/converter"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isDesktop()) {
    const token = process.env.HOLDALL_LAUNCH_TOKEN;
    const decision = desktopGate({
      token,
      port: Number(process.env.PORT ?? 3000),
      host: request.headers.get("host") ?? undefined,
      cookieToken: request.cookies.get(launchCookie)?.value,
      queryToken: request.nextUrl.searchParams.get("launch") ?? undefined,
    });
    if (decision === "deny") return new NextResponse("Open Holdall from the desktop app.", { status: 403, headers: { "Content-Type": "text/plain" } });
    if (decision === "set-cookie" && token) {
      const clean = request.nextUrl.clone();
      clean.searchParams.delete("launch");
      const response = NextResponse.redirect(clean);
      response.cookies.set(launchCookie, token, { httpOnly: true, sameSite: "lax", path: "/" });
      return response;
    }
  }

  if (!isPublicPath(pathname) && !getSessionCookie(request)) {
    if (isApi) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/api/plugins/") && pathname.split("/")[4] === "ui") return NextResponse.next();

  const isolated = crossOriginIsolatedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === "development", crossOriginIsolated: isolated });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(staticSecurityHeaders)) response.headers.set(name, value);
  if (isolated) {
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|api/files/upload).*)"],
};
