const publicPages = new Set(["/login", "/register", "/setup", "/demo"]);
const publicPrefixes = ["/invite/", "/reset/", "/api/auth/"];
const publicApi = new Set(["/api/health", "/api/desktop/start", "/api/demo/start"]);

export function isPublicPath(pathname: string): boolean {
  if (publicPages.has(pathname) || publicApi.has(pathname)) return true;
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix) && !pathname.slice(prefix.length).includes(".."));
}
