const publicPages = new Set(["/login", "/register", "/setup", "/demo"]);
const publicPrefixes = ["/invite/", "/reset/", "/api/auth/"];
const publicApi = new Set(["/api/health", "/api/desktop/start", "/api/demo/start"]);

const pluginAssets = /^\/api\/plugins\/[A-Za-z0-9.-]+\/ui\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\//;

export function isPublicPath(pathname: string): boolean {
  if (publicPages.has(pathname) || publicApi.has(pathname)) return true;
  if (pluginAssets.test(pathname) && !pathname.includes("..")) return true;
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix) && !pathname.slice(prefix.length).includes(".."));
}
