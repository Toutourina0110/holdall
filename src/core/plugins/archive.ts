import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { UserFacingError } from "@/core/errors";
import { manifestSchema, type PluginManifest } from "./manifest";
import { themeSchema, type Theme } from "@/core/theme/schema";

export const maxArchiveBytes = 20 * 1024 * 1024;
const maxUnpackedBytes = 60 * 1024 * 1024;
const maxFiles = 500;

export type UnpackedPlugin = { manifest: PluginManifest; files: Map<string, Uint8Array>; sha256: string };

export function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function safeEntryName(name: string): string | undefined {
  if (name.endsWith("/")) return undefined;
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) throw new UserFacingError("The plugin archive contains an absolute path. It was refused.");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === ".." || segment === "")) throw new UserFacingError("The plugin archive tries to write outside its folder. It was refused.");
  if (!/^[A-Za-z0-9_./ -]+$/.test(normalized)) throw new UserFacingError("The plugin archive contains a file name with unsupported characters.");
  return normalized;
}

export function unpackPlugin(archive: Uint8Array, expectedSha256?: string): UnpackedPlugin {
  if (archive.byteLength > maxArchiveBytes) throw new UserFacingError("The plugin archive is larger than 20 MB.");
  const digest = sha256(archive);
  if (expectedSha256 && digest !== expectedSha256.toLowerCase()) {
    throw new UserFacingError("The archive checksum does not match. It may be damaged or changed. Nothing was installed.");
  }
  let entries: Record<string, Uint8Array>;
  let total = 0;
  let count = 0;
  try {
    entries = unzipSync(archive, {
      filter(file) {
        count += 1;
        total += file.originalSize;
        if (count > maxFiles || total > maxUnpackedBytes) throw new UserFacingError("The plugin archive is too large once unpacked.");
        return true;
      },
    });
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError("This file is not a valid plugin archive (zip).");
  }
  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    const safe = safeEntryName(name);
    if (safe) files.set(safe, data);
  }
  const rawManifest = files.get("holdall.plugin.json");
  if (!rawManifest) throw new UserFacingError("The archive has no holdall.plugin.json at its root.");
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(rawManifest));
  } catch {
    throw new UserFacingError("holdall.plugin.json is not valid JSON.");
  }
  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new UserFacingError(`holdall.plugin.json is invalid: ${issue?.path.join(".") || "manifest"} ${issue?.message ?? ""}`.trim());
  }
  const manifest = parsed.data;
  for (const file of [manifest.entry.server, manifest.entry.ui, manifest.theme, ...manifest.contributes.widgets.map((widget) => widget.entry), manifest.contributes.page?.entry]) {
    if (file && !files.has(file)) throw new UserFacingError(`The manifest points to ${file}, which is not in the archive.`);
  }
  if (manifest.theme) readTheme(files.get(manifest.theme)!);
  return { manifest, files, sha256: digest };
}

export function readTheme(data: Uint8Array): Theme {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new UserFacingError("The theme file is not valid JSON.");
  }
  const parsed = themeSchema.safeParse(json);
  if (!parsed.success) throw new UserFacingError(`The theme file is invalid: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  return parsed.data;
}
