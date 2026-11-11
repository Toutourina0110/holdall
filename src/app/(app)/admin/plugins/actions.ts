"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { stopPluginProcess } from "@/core/plugins/host";
import { confirmInstall, discardStaged, stagePlugin, stagePluginFromUrl, uninstallPlugin } from "@/core/plugins/install";
import { stageFromRegistry } from "@/core/plugins/registry";
import { setPluginPermission } from "@/core/plugins/store";

export type StageState = { error?: string };

function message(error: unknown): string {
  return error instanceof UserFacingError ? error.message : "The plugin could not be read. Check the file and try again.";
}

const demoOff = "Installing plugins is turned off on the demo instance.";

export async function stageUploadAction(_state: StageState, formData: FormData): Promise<StageState> {
  await requireAdmin();
  if (getEnv().demoMode) return { error: demoOff };
  const file = formData.get("archive");
  const url = String(formData.get("url") ?? "").trim();
  const checksum = String(formData.get("sha256") ?? "").trim() || undefined;
  if (checksum && !/^[0-9a-fA-F]{64}$/.test(checksum)) return { error: "The checksum must be 64 hexadecimal characters." };
  let stageId: string;
  try {
    if (file instanceof File && file.size > 0) {
      stageId = stagePlugin(new Uint8Array(await file.arrayBuffer()), { expectedSha256: checksum, source: "third-party" }).stageId;
    } else if (url) {
      stageId = (await stagePluginFromUrl(url, checksum, "third-party")).stageId;
    } else {
      return { error: "Choose a plugin archive or enter its address." };
    }
  } catch (error) {
    return { error: message(error) };
  }
  redirect(`/admin/plugins/install/${stageId}`);
}

export async function confirmInstallAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  if (getEnv().demoMode) throw new UserFacingError(demoOff);
  const stageId = String(formData.get("stageId") ?? "");
  const optional = formData.getAll("optional").map(String);
  const manifest = confirmInstall(stageId, optional, session.user.id);
  stopPluginProcess(manifest.id);
  revalidatePath("/", "layout");
  redirect("/admin/plugins");
}

export async function cancelInstallAction(formData: FormData): Promise<void> {
  await requireAdmin();
  discardStaged(String(formData.get("stageId") ?? ""));
  redirect("/admin/plugins");
}

export async function uninstallAction(pluginId: string): Promise<void> {
  await requireAdmin();
  stopPluginProcess(pluginId);
  uninstallPlugin(pluginId);
  revalidatePath("/", "layout");
}

export async function togglePermissionAction(pluginId: string, permission: string, granted: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    setPluginPermission(pluginId, permission, granted);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The permission could not be changed." };
  }
  stopPluginProcess(pluginId);
  revalidatePath("/", "layout");
  return {};
}

export async function stageFromStoreAction(id: string): Promise<StageState> {
  await requireAdmin();
  if (getEnv().demoMode) return { error: demoOff };
  let stageId: string;
  try {
    stageId = (await stageFromRegistry(String(id))).stageId;
  } catch (error) {
    return { error: message(error) };
  }
  redirect(`/admin/plugins/install/${stageId}`);
}
