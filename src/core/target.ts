import { z } from "zod";

export type Target = "desktop" | "server";

const targetSchema = z.enum(["desktop", "server"]);

export function parseTarget(value: string | undefined): Target {
  if (value === undefined) return "server";
  const result = targetSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`HOLDALL_TARGET is "${value}". Set it to one of: desktop, server.`);
  }
  return result.data;
}

export function getTarget(): Target {
  return parseTarget(process.env.HOLDALL_TARGET);
}

export function isDesktop(): boolean {
  return getTarget() === "desktop";
}
