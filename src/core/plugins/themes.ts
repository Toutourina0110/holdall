import fs from "node:fs";
import path from "node:path";
import type { Theme } from "@/core/theme/schema";
import { readTheme } from "./archive";
import { installedDir } from "./install";
import { listInstalledPlugins } from "./store";

export type InstalledTheme = { id: string; name: string; source: "official" | "third-party"; theme: Theme };

export function installedThemes(): InstalledTheme[] {
  const themes: InstalledTheme[] = [];
  for (const item of listInstalledPlugins()) {
    if (item.manifest.type !== "theme" || !item.manifest.theme) continue;
    try {
      const theme = readTheme(fs.readFileSync(path.join(installedDir(item.id), item.manifest.theme)));
      themes.push({ id: item.id, name: item.manifest.name, source: item.source === "official" ? "official" : "third-party", theme });
    } catch {
      continue;
    }
  }
  return themes;
}
