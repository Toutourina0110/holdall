import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { UserFacingError } from "@/core/errors";
import { registerJobHandler } from "@/core/jobs/queue";
import { ffmpegPath } from "@/modules/downloader/tools";
import { fileInfo, parseRoot, rootDir, uniqueTarget } from "@/modules/files/store";
import { ffmpegArgs } from "./formats";

function parseDuration(stderr: string): number | undefined {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!match) return undefined;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

registerJobHandler("converter.convert", async (job, context) => {
  const payload = job.payload as { root: string; path: string; target: string };
  const root = parseRoot(payload.root);
  const binary = ffmpegPath();
  if (!binary) throw new UserFacingError("ffmpeg is not installed. An admin can install it from the Downloads page.");
  const source = fileInfo(job.userId, root, payload.path);
  if (source.type === "folder") throw new UserFacingError("Folders cannot be converted.");
  const base = source.name.slice(0, source.name.length - path.extname(source.name).length);
  const output = uniqueTarget(path.dirname(source.full), `${base}.${payload.target}`);
  const args = ffmpegArgs(source.full, output, payload.target);
  context.progress(0, "Starting");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let total: number | undefined;
    const stop = () => child.kill();
    context.signal.addEventListener("abort", stop, { once: true });
    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-20000);
      total ??= parseDuration(stderr);
    });
    child.stdout.on("data", (chunk: string) => {
      const match = chunk.match(/out_time_us=(\d+)/g)?.pop()?.split("=")[1];
      if (match && total) context.progress(Math.min(0.99, Number(match) / 1_000_000 / total));
    });
    child.on("error", (error) => reject(new UserFacingError(`ffmpeg could not be started: ${error.message}`)));
    child.on("close", (code) => {
      context.signal.removeEventListener("abort", stop);
      if (context.signal.aborted) {
        fs.rmSync(output, { force: true });
        reject(new Error("Cancelled."));
      } else if (code === 0 && fs.existsSync(output)) resolve();
      else {
        fs.rmSync(output, { force: true });
        const line = stderr.trim().split(/\r?\n/).pop() ?? `ffmpeg stopped with code ${code}.`;
        reject(new UserFacingError(`The conversion failed: ${line.slice(0, 200)}`));
      }
    });
  });
  const relative = path.relative(rootDir(job.userId, root), output).split(path.sep).join("/");
  return { root, file: relative, size: fs.statSync(output).size };
});
