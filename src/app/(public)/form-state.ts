import { APIError } from "better-auth/api";
import type { z } from "zod";
import { UserFacingError } from "@/core/errors";
import { createLogger } from "@/core/log";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const log = createLogger("forms");

const knownAuthErrors: Record<string, string> = {
  USER_ALREADY_EXISTS: "An account with this email already exists. Sign in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists. Sign in instead.",
  PASSWORD_TOO_SHORT: "Use at least 10 characters for the password.",
  PASSWORD_TOO_LONG: "Use 128 characters or fewer for the password.",
  INVALID_EMAIL: "Enter a valid email address.",
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
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof APIError) {
    const code = String(error.body?.code ?? "");
    if (knownAuthErrors[code]) return knownAuthErrors[code];
  }
  log.error("Unexpected form error", { error: error instanceof Error ? error.message : String(error) });
  return "Something went wrong. Try again in a moment.";
}
