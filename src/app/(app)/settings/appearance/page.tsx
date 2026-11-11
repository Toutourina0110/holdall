import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { installedThemes } from "@/core/plugins/themes";
import { getUserTheme } from "@/core/theme/store";
import { InstalledThemes } from "./InstalledThemes";
import { ThemeEditor } from "./ThemeEditor";

export const metadata: Metadata = { title: strings.settings.tabAppearance };

export default async function AppearancePage() {
  const session = await requireSession();
  const choice = getUserTheme(session.user.id);
  const themes = installedThemes().map((item) => ({ id: item.id, name: item.name, base: item.theme.base, source: item.source }));
  return (
    <>
      {themes.length > 0 && <InstalledThemes themes={themes} />}
      <ThemeEditor key={JSON.stringify(choice)} mode={choice.mode} theme={choice.theme} />
    </>
  );
}
