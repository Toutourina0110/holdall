import { z } from "zod";
import { UserFacingError } from "@/core/errors";

export const downloadOptionsSchema = z.object({
  kind: z.enum(["video", "audio"]),
  container: z.enum(["mp4", "webm", "mkv"]).default("mp4"),
  quality: z.enum(["best", "2160", "1440", "1080", "720", "480", "360"]).default("best"),
  audioFormat: z.enum(["mp3", "m4a", "opus"]).default("mp3"),
  formatId: z
    .string()
    .regex(/^[A-Za-z0-9_+\-/[\]<>=.*]{1,80}$/, "Invalid format.")
    .optional(),
});

export type DownloadOptions = z.infer<typeof downloadOptionsSchema>;

export function parseLinks(text: string): string[] {
  const links = text
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (links.length === 0) throw new UserFacingError("Paste at least one link.");
  if (links.length > 50) throw new UserFacingError("Paste 50 links at most at once.");
  return [...new Set(links.map(checkLink))];
}

export function checkLink(value: string): string {
  if (value.length > 2000) throw new UserFacingError("This link is too long.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UserFacingError(`"${value.slice(0, 80)}" is not a link. Paste a full address starting with https://.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UserFacingError("Only http and https links can be downloaded.");
  if (url.username || url.password) throw new UserFacingError("Links with a user name or password are not accepted.");
  return url.toString();
}

function videoSelector(options: DownloadOptions): string {
  if (options.formatId) return options.formatId;
  const height = options.quality === "best" ? "" : `[height<=${options.quality}]`;
  const ext = options.container === "mp4" ? "[ext=mp4]" : options.container === "webm" ? "[ext=webm]" : "";
  const audioExt = options.container === "mp4" ? "[ext=m4a]" : options.container === "webm" ? "[ext=webm]" : "";
  return `bv*${height}${ext}+ba${audioExt}/bv*${height}+ba/b${height}/b`;
}

export function probeArgs(url: string): string[] {
  return ["--dump-single-json", "--flat-playlist", "--no-warnings", "--no-progress", "--ignore-config", "--use-extractors", "default,-generic", "--", checkLink(url)];
}

export function downloadArgs(input: { url: string; options: DownloadOptions; outputDir: string; ffmpegPath?: string }): string[] {
  const options = downloadOptionsSchema.parse(input.options);
  const args = [
    "--ignore-config",
    "--use-extractors",
    "default,-generic",
    "--no-playlist",
    "--newline",
    "--continue",
    "--no-overwrites",
    "--windows-filenames",
    "--no-exec",
    "--progress-template",
    "download:[holdall]%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
    "--print",
    "after_move:[holdall-file]%(filepath)s",
    "-P",
    input.outputDir,
    "-o",
    "%(title).150B [%(id)s].%(ext)s",
  ];
  if (input.ffmpegPath) args.push("--ffmpeg-location", input.ffmpegPath);
  if (options.kind === "audio") {
    args.push("-f", "ba/b", "-x", "--audio-format", options.audioFormat, "--audio-quality", "0");
  } else {
    args.push("-f", videoSelector(options), "--merge-output-format", options.container);
  }
  args.push("--", checkLink(input.url));
  return args;
}

export type Progress = { percent: number; speed: string; eta: string };

export function parseProgress(line: string): Progress | undefined {
  const match = line.match(/^\[holdall\]\s*([\d.]+)%\|([^|]*)\|(.*)$/);
  if (!match) return undefined;
  return { percent: Math.min(100, Number(match[1])), speed: match[2]!.trim(), eta: match[3]!.trim() };
}

export function parseFinalPath(line: string): string | undefined {
  return line.startsWith("[holdall-file]") ? line.slice("[holdall-file]".length).trim() : undefined;
}
