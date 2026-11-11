import { z } from "zod";
import { defaultRegistryUrl, getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { safeFetch } from "@/core/security/safe-fetch";
import { discardStaged, stagePluginFromUrl, type StagedPlugin } from "./install";

const entrySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/),
  name: z.string().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  type: z.enum(["module", "extension", "library", "theme"]),
  description: z.string().max(500).default(""),
  author: z.object({ name: z.string().min(1).max(80), url: z.url().max(300).optional() }),
  archive: z.url().max(1000).refine((value) => value.startsWith("https://"), "Archives must use https."),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  official: z.boolean().default(false),
});

const indexSchema = z.object({
  version: z.literal(1),
  plugins: z.array(z.unknown()).max(2000),
});

export type RegistryEntry = z.infer<typeof entrySchema> & { source: "official" | "third-party" };

const cacheMs = 10 * 60 * 1000;
let cache: { url: string; at: number; entries: RegistryEntry[] } | undefined;

export function parseRegistry(body: unknown, trustOfficial: boolean): RegistryEntry[] {
  const index = indexSchema.safeParse(body);
  if (!index.success) throw new UserFacingError("The plugin store answered with an unexpected format.");
  const entries: RegistryEntry[] = [];
  const seen = new Set<string>();
  for (const raw of index.data.plugins) {
    const entry = entrySchema.safeParse(raw);
    if (!entry.success || seen.has(entry.data.id)) continue;
    seen.add(entry.data.id);
    entries.push({ ...entry.data, source: trustOfficial && entry.data.official ? "official" : "third-party" });
  }
  return entries;
}

export async function loadRegistry(force = false): Promise<RegistryEntry[]> {
  const url = getEnv().pluginRegistryUrl;
  if (!force && cache && cache.url === url && Date.now() - cache.at < cacheMs) return cache.entries;
  const response = await safeFetch(url, { maxBytes: 2 * 1024 * 1024, timeoutMs: 15000, redirects: 2 });
  if (response.status !== 200) throw new UserFacingError(`The plugin store could not be reached (${response.status}). Try again later.`);
  let body: unknown;
  try {
    body = JSON.parse(response.body.toString("utf8"));
  } catch {
    throw new UserFacingError("The plugin store answered with an unexpected format.");
  }
  const entries = parseRegistry(body, url === defaultRegistryUrl);
  cache = { url, at: Date.now(), entries };
  return entries;
}

export async function stageFromRegistry(id: string): Promise<StagedPlugin> {
  const entry = (await loadRegistry()).find((item) => item.id === id);
  if (!entry) throw new UserFacingError("This plugin is not in the store anymore.");
  const staged = await stagePluginFromUrl(entry.archive, entry.sha256, entry.source);
  if (staged.manifest.id !== entry.id || staged.manifest.version !== entry.version) {
    discardStaged(staged.stageId);
    throw new UserFacingError("The downloaded plugin does not match the store listing. It was not installed.");
  }
  return staged;
}
