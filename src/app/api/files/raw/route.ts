import fs from "node:fs";
import { Readable } from "node:stream";
import { apiSession, unauthorized } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { extensionOf, fileInfo, parseRoot } from "@/modules/files/store";

const inlineTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  flac: "audio/flac",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  markdown: "text/plain; charset=utf-8",
  json: "text/plain; charset=utf-8",
  csv: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  xml: "text/plain; charset=utf-8",
  yml: "text/plain; charset=utf-8",
  yaml: "text/plain; charset=utf-8",
  ini: "text/plain; charset=utf-8",
  srt: "text/plain; charset=utf-8",
  vtt: "text/plain; charset=utf-8",
};

function disposition(kind: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^A-Za-z0-9 ._()[\]-]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const params = new URL(request.url).searchParams;
  let info;
  try {
    info = fileInfo(session.user.id, parseRoot(params.get("root")), params.get("path") ?? "");
  } catch (error) {
    return Response.json({ error: error instanceof UserFacingError ? error.message : "Not found." }, { status: 404 });
  }
  if (info.type === "folder") return Response.json({ error: "This is a folder." }, { status: 400 });
  const download = params.get("download") === "1";
  const type = download ? undefined : inlineTypes[extensionOf(info.name)];
  const size = info.stat.size;
  const headers = new Headers({
    "Content-Type": type ?? "application/octet-stream",
    "Content-Disposition": disposition(type ? "inline" : "attachment", info.name),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });
  if (type === "application/pdf") headers.set("Content-Security-Policy", "default-src 'none'; object-src 'self'; frame-ancestors 'self'");
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && size > 0) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(Readable.toWeb(fs.createReadStream(info.full, { start, end })) as ReadableStream, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(fs.createReadStream(info.full)) as ReadableStream, { headers });
}
