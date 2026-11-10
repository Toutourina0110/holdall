"use server";

import { redirect } from "next/navigation";
import { acceptInvitation, accountInput, createFirstAdmin, registerOpenAccount } from "@/core/auth/accounts";
import { fieldErrors, friendlyError, type FormState } from "./form-state";

async function createAccount(formData: FormData, create: (input: ReturnType<typeof accountInput.parse>) => Promise<unknown>): Promise<FormState> {
  const parsed = accountInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    await create(parsed.data);
  } catch (error) {
    return { error: friendlyError(error) };
  }
  redirect("/");
}

export async function setupAction(_state: FormState, formData: FormData): Promise<FormState> {
  return createAccount(formData, createFirstAdmin);
}

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  return createAccount(formData, registerOpenAccount);
}

export async function inviteAction(_state: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  return createAccount(formData, (input) => acceptInvitation(token, input));
}
