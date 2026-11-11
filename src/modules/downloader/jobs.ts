import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { registerJobHandler } from "@/core/jobs/queue";
import { createLogger } from "@/core/log";
import { userPath } from "@/core/paths";
import { doAction } from "@/core/plugins/hooks";
import { downloadArgs, downloadOptionsSchema, parseFinalPath, parseProgress, probeArgs } from "./args";
import { canManageTools, ffmpegPath, installFfmpeg, updateIsDue, updateYtdlp, ytdlpPath } from "./tools";

const log = createLogger("downloader");

export type ProbeResult = {
  kind: "video" | "playlist";
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  url: string;
  formats: { id: string; ext: string; height?: number; fps?: number; vcodec?: string; acodec?: string; size?: number; note?: string }[];
  entries: { url: string; title: string; duration?: number }[];
};

type RawInfo = {
  _type?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
  original_url?: string;
  formats?: { format_id?: string; ext?: string; height?: number; fps?: number; vcodec?: string; acodec?: string; filesize?: number; filesize_approx?: number; format_note?: string }[];
  entries?: { url?: string; webpage_url?: string; title?: string; duration?: number }[];
};

function requireYtdlp(): string {
  const binary = ytdlpPath();
  if (!binary) throw new UserFacingError("yt-dlp is not installed yet. An admin can install it from the Downloads page.");
  return binary;
}

function run(binary: string, args: string[], signal: AbortSignal, onLine?: (line: string) => void, maxStdout = 0) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let buffer = "";
    const stop = () => child.kill();
    signal.addEventListener("abort", stop, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (maxStdout > 0) {
        stdout += chunk;
        if (stdout.length > maxStdout) child.kill();
      }
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) onLine?.(line);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000);
    });
    child.on("error", (error) => reject(new UserFacingError(`yt-dlp could not be started: ${error.message}`)));
    child.on("close", (code) => {
      signal.removeEventListener("abort", stop);
      if (buffer) onLine?.(buffer);
      if (signal.aborted) reject(new Error("Cancelled."));
      else if (code === 0) resolve({ stdout, stderr });
      else {
        const reason = stderr.split(/\r?\n/).filter((line) => line.startsWith("ERROR")).pop() ?? `yt-dlp stopped with code ${code}.`;
        reject(new UserFacingError(reason.replace(/^ERROR:\s*/, "").slice(0, 300)));
      }
    });
  });
}

function summarize(info: RawInfo, url: string): ProbeResult {
  const isPlaylist = info._type === "playlist" || Array.isArray(info.entries);
  return {
    kind: isPlaylist ? "playlist" : "video",
    title: String(info.title ?? url).slice(0, 300),
    uploader: (info.uploader ?? info.channel)?.slice(0, 120),
    duration: typeof info.duration === "number" ? info.duration : undefined,
    thumbnail: typeof info.thumbnail === "string" && info.thumbnail.startsWith("https://") ? info.thumbnail : undefined,
    url: info.webpage_url ?? info.original_url ?? url,
    formats: (info.formats ?? [])
      .filter((format) => format.format_id)
      .slice(-60)
      .reverse()
      .map((format) => ({
        id: String(format.format_id).slice(0, 80),
        ext: String(format.ext ?? ""),
        height: format.height ?? undefined,
        fps: format.fps ?? undefined,
        vcodec: format.vcodec && format.vcodec !== "none" ? format.vcodec : undefined,
        acodec: format.acodec && format.acodec !== "none" ? format.acodec : undefined,
        size: format.filesize ?? format.filesize_approx ?? undefined,
        note: format.format_note?.slice(0, 60),
      })),
    entries: (info.entries ?? [])
      .map((entry) => ({ url: entry.webpage_url ?? entry.url ?? "", title: String(entry.title ?? entry.url ?? "").slice(0, 300), duration: entry.duration }))
      .filter((entry) => /^https?:\/\//.test(entry.url))
      .slice(0, 500),
  };
}

function refuseInDemo() {
  if (getEnv().demoMode) throw new UserFacingError("Downloads are turned off on the demo instance.");
}

registerJobHandler("downloader.probe", async (job, context) => {
  refuseInDemo();
  const { url } = job.payload as { url: string };
  context.progress(0.1, "Reading the link");
  const { stdout } = await run(requireYtdlp(), probeArgs(url), context.signal, undefined, 30 * 1024 * 1024);
  return summarize(JSON.parse(stdout) as RawInfo, url);
});

registerJobHandler("downloader.download", async (job, context) => {
  refuseInDemo();
  const payload = job.payload as { url: string; title?: string; options: unknown };
  const options = downloadOptionsSchema.parse(payload.options);
  const outputDir = userPath(getEnv().dataDir, "downloads", job.userId);
  fs.mkdirSync(outputDir, { recursive: true });
  let finalPath: string | undefined;
  context.progress(0, "Starting");
  await run(
    requireYtdlp(),
    downloadArgs({ url: payload.url, options, outputDir, ffmpegPath: ffmpegPath() }),
    context.signal,
    (line) => {
      const progress = parseProgress(line);
      if (progress) context.progress(progress.percent / 100, `${progress.speed}|${progress.eta}`);
      finalPath = parseFinalPath(line) ?? finalPath;
    },
  );
  if (!finalPath) throw new UserFacingError("yt-dlp finished without saving a file.");
  const relative = path.relative(outputDir, path.resolve(finalPath));
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(finalPath)) {
    throw new UserFacingError("The downloaded file was saved outside your downloads folder and was ignored.");
  }
  const size = fs.statSync(finalPath).size;
  void doAction("download.finished", { id: job.id, file: relative, title: payload.title }, { userId: job.userId }).catch(() => undefined);
  return { file: relative.split(path.sep).join("/"), size };
});

registerJobHandler("downloader.tools", async (_job, context) => {
  context.progress(0.1, "Checking yt-dlp");
  const ytdlp = await updateYtdlp();
  let ffmpeg: string | undefined;
  if (!ffmpegPath() && process.platform === "win32") {
    context.progress(0.5, "Installing ffmpeg");
    ffmpeg = await installFfmpeg();
  }
  return { ytdlp, ffmpeg };
});

export async function autoUpdateTools(): Promise<void> {
  if (!canManageTools() || !getEnv().ytdlpAutoUpdate || (ytdlpPath() && !updateIsDue())) return;
  try {
    const tag = await updateYtdlp();
    log.info("yt-dlp is up to date", { version: tag });
    if (!ffmpegPath() && process.platform === "win32") await installFfmpeg();
  } catch (error) {
    log.warn("yt-dlp update failed", { error: error instanceof Error ? error.message : String(error) });
  }
}
