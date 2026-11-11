import { UserFacingError } from "@/core/errors";
import { extensionOf, fileType, type FileType } from "@/modules/files/store";

export const imageTargets = ["png", "jpg", "webp", "avif", "gif", "bmp", "tiff"] as const;
export const audioTargets = ["mp3", "m4a", "opus", "ogg", "wav", "flac"] as const;
export const videoTargets = ["mp4", "webm", "mkv", "mov", "gif"] as const;

export function targetsFor(name: string): string[] {
  const type = fileType(name);
  const own = extensionOf(name);
  const list: readonly string[] = type === "image" ? imageTargets : type === "audio" ? audioTargets : type === "video" ? [...videoTargets, ...audioTargets] : [];
  return list.filter((target) => target !== own && !(own === "jpeg" && target === "jpg") && !(own === "tif" && target === "tiff"));
}

const codecArgs: Record<string, string[]> = {
  "video:mp4": ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"],
  "video:mkv": ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-c:a", "aac", "-b:a", "160k"],
  "video:mov": ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k"],
  "video:webm": ["-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1", "-c:a", "libopus", "-b:a", "128k"],
  "video:gif": ["-vf", "fps=12,scale=480:-1:flags=lanczos", "-loop", "0"],
  "audio:mp3": ["-vn", "-c:a", "libmp3lame", "-q:a", "2"],
  "audio:m4a": ["-vn", "-c:a", "aac", "-b:a", "192k"],
  "audio:opus": ["-vn", "-c:a", "libopus", "-b:a", "128k"],
  "audio:ogg": ["-vn", "-c:a", "libvorbis", "-q:a", "5"],
  "audio:wav": ["-vn", "-c:a", "pcm_s16le"],
  "audio:flac": ["-vn", "-c:a", "flac"],
  "image:png": [],
  "image:jpg": ["-q:v", "2"],
  "image:webp": ["-quality", "85"],
  "image:avif": ["-c:v", "libaom-av1", "-still-picture", "1", "-crf", "30"],
  "image:gif": [],
  "image:bmp": [],
  "image:tiff": [],
};

function family(type: FileType, target: string): "video" | "audio" | "image" {
  if (type === "image") return "image";
  if ((audioTargets as readonly string[]).includes(target)) return "audio";
  return "video";
}

export function ffmpegArgs(input: string, output: string, target: string): string[] {
  const name = input.replace(/\\/g, "/").split("/").pop() ?? input;
  if (!targetsFor(name).includes(target)) throw new UserFacingError(`This file cannot be converted to ${target}.`);
  const codecs = codecArgs[`${family(fileType(name), target)}:${target}`];
  if (!codecs) throw new UserFacingError(`This file cannot be converted to ${target}.`);
  const frames = fileType(name) === "image" && target !== "gif" ? ["-frames:v", "1", "-update", "1"] : [];
  return ["-hide_banner", "-nostdin", "-n", "-i", input, ...codecs, ...frames, "-progress", "pipe:1", "-nostats", output];
}
