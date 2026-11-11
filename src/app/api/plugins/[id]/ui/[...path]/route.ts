import fs from "node:fs";
import path from "node:path";
import { safeJoin } from "@/core/paths";
import { verifyAssetToken } from "@/core/plugins/asset-token";
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
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

const pluginCsp = [
  "default-src * data: blob:",
  "script-src * data: blob: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src * data: blob: 'unsafe-inline'",
  "img-src * data: blob:",
  "media-src * data: blob:",
  "font-src * data:",
  "connect-src * data: blob: ws: wss:",
  "frame-src * data: blob:",
  "worker-src * data: blob:",
  "form-action *",
  "base-uri 'none'",
  "frame-ancestors 'self'",
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads",
].join("; ");

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  const { id, path: all } = await params;
  const [token = "", ...segments] = all;
  const userId = verifyAssetToken(id, token);
  const installed = getInstalledPlugin(id);
  if (!userId || !installed || !isPluginEnabledFor(userId, id) || segments.length === 0) return notFound();
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
