"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/core/auth/server";
import { requireSession } from "@/core/auth/session";
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

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
