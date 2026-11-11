import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { apiSession, unauthorized } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { desktopRequestAllowed } from "@/core/security/desktop-gate";
import { isDesktop } from "@/core/target";
import { cleanName, parseRoot, resolve, rootDir, uniqueTarget } from "@/modules/files/store";

export async function POST(request: Request) {
  if (isDesktop() && !desktopRequestAllowed(request)) return new Response("Open Holdall from the desktop app.", { status: 403 });
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const params = new URL(request.url).searchParams;
  const env = getEnv();
  const limit = (env.demoMode ? 5 : env.maxUploadMb) * 1024 * 1024;
  let target: string;
  let temp: string;
  try {
    const root = parseRoot(params.get("root"));
    rootDir(session.user.id, root);
    const folder = resolve(session.user.id, root, params.get("path") ?? "");
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new UserFacingError("The destination folder does not exist.");
    const name = cleanName(decodeURIComponent(request.headers.get("x-file-name") ?? ""));
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > limit) throw new UserFacingError(`Files are limited to ${Math.round(limit / 1024 / 1024)} MB.`);
    if (!request.body) throw new UserFacingError("The upload was empty.");
    target = uniqueTarget(folder, name);
    temp = path.join(folder, `.${path.basename(target)}.${Date.now()}.upload`);
  } catch (error) {
    return Response.json({ error: error instanceof UserFacingError ? error.message : "The upload failed." }, { status: 400 });
  }
  let received = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > limit) callback(new UserFacingError(`Files are limited to ${Math.round(limit / 1024 / 1024)} MB.`));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), counter, fs.createWriteStream(temp, { flags: "wx" }));
    fs.renameSync(temp, target);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    return Response.json({ error: error instanceof UserFacingError ? error.message : "The upload was interrupted. Try again." }, { status: 400 });
  }
  return Response.json({ name: path.basename(target), size: received });
}
