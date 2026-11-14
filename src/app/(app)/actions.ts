"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/core/auth/server";
import { requireAdmin, requireSession } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { triggerUpdate } from "@/core/updates";
import { resetUserLayout, saveUserLayout } from "@/core/layout/store";

export async function saveLayoutAction(layout: unknown): Promise<{ error?: string }> {
  const session = await requireSession();
  try {
    saveUserLayout(session.user.id, layout);
  } catch {
    return { error: "This layout could not be saved. Reset it and try again." };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function resetLayoutAction(): Promise<void> {
  const session = await requireSession();
  resetUserLayout(session.user.id);
  revalidatePath("/", "layout");
}

export async function triggerUpdateAction(): Promise<{ error?: string; started?: boolean }> {
  await requireAdmin();
  try {
    await triggerUpdate();
  } catch (error) {
    return { error: error instanceof UserFacingError ? error.message : "The update could not be started. Try again." };
  }
  return { started: true };
}

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
