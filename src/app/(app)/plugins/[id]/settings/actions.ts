"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { saveSettings } from "@/core/plugins/settings";
import { getInstalledPlugin, isPluginEnabledFor } from "@/core/plugins/store";

export type SettingsState = { error?: string; saved?: boolean };

export async function saveSettingsAction(pluginId: string, scope: "global" | "personal", _state: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireSession();
  if (!getInstalledPlugin(pluginId)) return { error: "This plugin is not installed anymore." };
  if (scope === "global" && session.user.role !== "admin") return { error: "Only an admin can change these settings." };
  if (scope === "personal" && !isPluginEnabledFor(session.user.id, pluginId)) return { error: "Turn the plugin on before changing its settings." };
  const input: Record<string, unknown> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("setting.") && typeof value === "string") input[name.slice("setting.".length)] = value;
  }
  try {
    saveSettings(pluginId, session.user.id, scope === "global" ? "global" : "personal", input, formData.getAll("clear").map(String));
  } catch (error) {
    return { error: error instanceof UserFacingError ? error.message : "The settings could not be saved. Try again." };
  }
  revalidatePath(`/plugins/${pluginId}/settings`);
  return { saved: true };
}
