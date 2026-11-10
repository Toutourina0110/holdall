import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import packageJson from "../../../package.json";
import { getDb } from "@/core/db/client";
import { plugin, pluginPermission } from "@/core/db/schema";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { safeJoin } from "@/core/paths";
import { maxArchiveBytes, unpackPlugin } from "./archive";
import { satisfies, type PluginManifest } from "./manifest";
import { getInstalledPlugin } from "./store";

export const appVersion = packageJson.version;

export type StagedPlugin = {
  stageId: string;
  manifest: PluginManifest;
  sha256: string;
  source: "official" | "third-party";
  previous?: { version: string; granted: string[] };
};

function pluginsRoot(): string {
  return path.join(getEnv().dataDir, "plugins");
}

function stagingDir(stageId: string): string {
  if (!/^[0-9a-f-]{36}$/.test(stageId)) throw new UserFacingError("This installation request is not valid anymore. Start again.");
  return path.join(pluginsRoot(), ".staging", stageId);
}

export function installedDir(pluginId: string): string {
  return safeJoin(pluginsRoot(), pluginId);
}

export function stagePlugin(archive: Uint8Array, options: { expectedSha256?: string; source: "official" | "third-party" }): StagedPlugin {
  const { manifest, files, sha256 } = unpackPlugin(archive, options.expectedSha256);
  if (!satisfies(appVersion, manifest.holdall)) {
    throw new UserFacingError(`${manifest.name} needs Holdall ${manifest.holdall}. This Holdall is ${appVersion}.`);
  }
  for (const [dependency, range] of Object.entries(manifest.dependencies)) {
    const installed = getInstalledPlugin(dependency);
    if (!installed || !satisfies(installed.version, range)) {
      throw new UserFacingError(`${manifest.name} needs the plugin ${dependency} ${range}. Install it first.`);
    }
  }
  const stageId = randomUUID();
  const dir = stagingDir(stageId);
  for (const [name, data] of files) {
    const target = safeJoin(dir, "files", name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  const previous = getInstalledPlugin(manifest.id);
  const staged: StagedPlugin = {
    stageId,
    manifest,
    sha256,
    source: options.source,
    previous: previous ? { version: previous.version, granted: [...previous.granted] } : undefined,
  };
  fs.writeFileSync(path.join(dir, "stage.json"), JSON.stringify(staged));
  return staged;
}

export async function stagePluginFromUrl(url: string, expectedSha256: string | undefined, source: "official" | "third-party"): Promise<StagedPlugin> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UserFacingError("Enter a full https:// address.");
  }
  if (parsed.protocol !== "https:") throw new UserFacingError("Plugins can only be downloaded over https.");
  const response = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(30000) }).catch(() => undefined);
  if (!response?.ok || !response.body) throw new UserFacingError("The plugin could not be downloaded. Check the address and try again.");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxArchiveBytes) throw new UserFacingError("The plugin archive is larger than 20 MB.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxArchiveBytes) {
      await reader.cancel();
      throw new UserFacingError("The plugin archive is larger than 20 MB.");
    }
    chunks.push(value);
  }
  const archive = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    archive.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return stagePlugin(archive, { expectedSha256, source });
}

export function readStaged(stageId: string): StagedPlugin {
  const file = path.join(stagingDir(stageId), "stage.json");
  if (!fs.existsSync(file)) throw new UserFacingError("This installation request is not valid anymore. Start again.");
  return JSON.parse(fs.readFileSync(file, "utf8")) as StagedPlugin;
}

export function discardStaged(stageId: string): void {
  fs.rmSync(stagingDir(stageId), { recursive: true, force: true });
}

export function confirmInstall(stageId: string, grantedOptional: string[], installedBy: string): PluginManifest {
  const staged = readStaged(stageId);
  const { manifest } = staged;
  const optional = new Set(grantedOptional.filter((permission) => manifest.optionalPermissions.includes(permission)));
  const target = installedDir(manifest.id);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(path.join(stagingDir(stageId), "files"), target);
  discardStaged(stageId);
  const db = getDb();
  db.transaction((tx) => {
    tx.insert(plugin)
      .values({ id: manifest.id, version: manifest.version, manifest: JSON.stringify(manifest), source: staged.source, sha256: staged.sha256, installedBy })
      .onConflictDoUpdate({
        target: plugin.id,
        set: { version: manifest.version, manifest: JSON.stringify(manifest), source: staged.source, sha256: staged.sha256, installedBy },
      })
      .run();
    tx.delete(pluginPermission).where(eq(pluginPermission.pluginId, manifest.id)).run();
    for (const permission of manifest.permissions) tx.insert(pluginPermission).values({ pluginId: manifest.id, permission, granted: true }).run();
    for (const permission of manifest.optionalPermissions) {
      tx.insert(pluginPermission).values({ pluginId: manifest.id, permission, granted: optional.has(permission) }).run();
    }
  });
  return manifest;
}

export function uninstallPlugin(pluginId: string): void {
  getDb().delete(plugin).where(eq(plugin.id, pluginId)).run();
  fs.rmSync(installedDir(pluginId), { recursive: true, force: true });
}
