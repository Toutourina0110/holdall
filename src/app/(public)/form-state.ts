import { APIError } from "better-auth/api";
import type { z } from "zod";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function friendlyError(error: unknown): string {
  if (error instanceof APIError) {
    const message = String(error.body?.message ?? error.message);
    if (/already exists/i.test(message)) return "An account with this email already exists. Sign in instead.";
    if (/password/i.test(message)) return message;
    return message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again in a moment.";
}
