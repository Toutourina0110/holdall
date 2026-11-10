import fs from "node:fs";
import path from "node:path";
import { apiSession, unauthorized } from "@/core/auth/session";
import { safeJoin } from "@/core/paths";
import { installedDir } from "@/core/plugins/install";
import { getInstalledPlugin, isPluginEnabledFor } from "@/core/plugins/store";

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const pluginCsp = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
  "sandbox allow-scripts",
].join("; ");

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const { id, path: segments } = await params;
  const installed = getInstalledPlugin(id);
  if (!installed || !isPluginEnabledFor(session.user.id, id)) return notFound();
  const relative = segments.join("/");
  if (relative === "holdall.plugin.json" || relative === installed.manifest.entry.server) return notFound();
  const type = types[path.extname(relative).toLowerCase()];
  if (!type) return notFound();
  let file: string;
  try {
    file = safeJoin(installedDir(id), ...segments);
  } catch {
    return notFound();
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound();
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": type,
      "Content-Security-Policy": pluginCsp,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cache-Control": "private, max-age=60",
    },
  });
}
