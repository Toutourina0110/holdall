import { eq } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { userTheme } from "@/core/db/schema";
import { themeSchema, type Theme, type ThemeMode } from "./schema";

export type UserThemeChoice = { mode: ThemeMode; theme?: Theme };

export function getUserTheme(userId: string): UserThemeChoice {
  const row = getDb().select().from(userTheme).where(eq(userTheme.userId, userId)).get();
  if (!row) return { mode: "system" };
  const parsed = row.theme ? themeSchema.safeParse(JSON.parse(row.theme)) : undefined;
  return { mode: row.mode, theme: parsed?.success ? parsed.data : undefined };
}

export function saveUserTheme(userId: string, mode: ThemeMode, theme?: unknown): UserThemeChoice {
  const valid = theme === undefined ? undefined : themeSchema.parse(theme);
  const json = valid ? JSON.stringify(valid) : null;
  getDb()
    .insert(userTheme)
    .values({ userId, mode, theme: json, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userTheme.userId, set: { mode, theme: json, updatedAt: new Date() } })
    .run();
  return { mode, theme: valid };
}

export function themeToCss(theme: Theme): string {
  const declarations = Object.entries(theme.tokens)
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");
  return `:root, :root[data-theme] { ${declarations} }${theme.css ? `\n${theme.css}` : ""}`;
}
