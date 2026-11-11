import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { apiSession, unauthorized } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { getJob } from "@/core/jobs/queue";
import { userPath } from "@/core/paths";

function notFound() {
  return Response.json({ error: "This file is not available." }, { status: 404 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const job = getJob(session.user.id, (await params).id);
  if (!job || job.type !== "downloader.download" || job.status !== "done" || !job.result) return notFound();
  const { file } = JSON.parse(job.result) as { file?: string };
  if (!file) return notFound();
  let full: string;
  try {
    full = userPath(getEnv().dataDir, "downloads", session.user.id, ...file.split("/"));
  } catch {
    return notFound();
  }
  if (!fs.existsSync(full)) return notFound();
  const name = path.basename(full);
  const ascii = name.replace(/[^A-Za-z0-9 ._()[\]-]/g, "_");
  return new Response(Readable.toWeb(fs.createReadStream(full)) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fs.statSync(full).size),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
