import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { getUserTheme } from "@/core/theme/store";
import { ThemeEditor } from "./ThemeEditor";

export const metadata: Metadata = { title: strings.settings.tabAppearance };

export default async function AppearancePage() {
  const session = await requireSession();
  const choice = getUserTheme(session.user.id);
  return <ThemeEditor mode={choice.mode} theme={choice.theme} />;
}
