"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/core/auth/session";
import { setPluginEnabledFor } from "@/core/plugins/store";

export async function setPluginEnabledAction(pluginId: unknown, enabled: unknown): Promise<void> {
  const session = await requireSession();
  if (typeof pluginId !== "string" || typeof enabled !== "boolean") return;
  setPluginEnabledFor(session.user.id, pluginId, enabled);
  revalidatePath("/", "layout");
}
