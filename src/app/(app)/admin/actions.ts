"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createInvitation, revokeInvitation, setRegistrationOpen, setUserRole } from "@/core/auth/accounts";
import { requireAdmin } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";

const role = z.enum(["admin", "user"]);

export async function setRoleAction(userId: unknown, nextRole: unknown): Promise<{ error?: string }> {
  await requireAdmin();
  const parsedRole = role.safeParse(nextRole);
  if (typeof userId !== "string" || !parsedRole.success) return { error: "Choose admin or member." };
  try {
    setUserRole(userId, parsedRole.data);
  } catch (error) {
    return { error: error instanceof UserFacingError ? error.message : "The role could not be changed. Try again." };
  }
  revalidatePath("/admin");
  return {};
}

export async function createInvitationAction(nextRole: unknown): Promise<{ link?: string; error?: string }> {
  const session = await requireAdmin();
  const parsedRole = role.safeParse(nextRole);
  if (!parsedRole.success) return { error: "Choose admin or member." };
  const { token } = createInvitation(session.user.id, parsedRole.data);
  revalidatePath("/admin");
  return { link: `${getEnv().appUrl}/invite/${token}` };
}

export async function revokeInvitationAction(id: unknown): Promise<void> {
  await requireAdmin();
  if (typeof id === "string") revokeInvitation(id);
  revalidatePath("/admin");
}

export async function setRegistrationAction(open: unknown): Promise<void> {
  await requireAdmin();
  setRegistrationOpen(open === true);
  revalidatePath("/admin");
}
