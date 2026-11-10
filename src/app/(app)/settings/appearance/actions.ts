"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/core/auth/session";
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
