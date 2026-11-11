"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/core/auth/session";
import { installedThemes } from "@/core/plugins/themes";
import { saveUserTheme } from "@/core/theme/store";

const modeSchema = z.enum(["system", "light", "dark", "custom"]);

export async function saveThemeAction(mode: unknown, theme?: unknown): Promise<{ error?: string }> {
  const session = await requireSession();
  const parsedMode = modeSchema.safeParse(mode);
  if (!parsedMode.success) return { error: "Choose system, light, dark or custom." };
  try {
    saveUserTheme(session.user.id, parsedMode.data, parsedMode.data === "custom" ? theme : undefined);
  } catch (error) {
    const issue = error instanceof z.ZodError ? error.issues[0]?.message : undefined;
    return { error: issue ?? "This theme could not be saved. Check the values and try again." };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function applyPluginThemeAction(pluginId: string): Promise<{ error?: string }> {
  const session = await requireSession();
  const found = installedThemes().find((item) => item.id === String(pluginId));
  if (!found) return { error: "This theme is not installed anymore." };
  saveUserTheme(session.user.id, "custom", found.theme);
  revalidatePath("/", "layout");
  return {};
}
