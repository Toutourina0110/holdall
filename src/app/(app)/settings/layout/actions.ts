"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/core/auth/session";
import { userLayoutSchema } from "@/core/layout/schema";
import { getUserLayout, saveUserLayout } from "@/core/layout/store";
import { themeSchema } from "@/core/theme/schema";
import { getUserTheme, saveUserTheme } from "@/core/theme/store";

const bundleSchema = z
  .object({
    kind: z.literal("holdall-layout"),
    version: z.literal(1),
    layout: userLayoutSchema,
    theme: z.object({ mode: z.enum(["system", "light", "dark", "custom"]), theme: themeSchema.optional() }),
  })
  .strict();

export async function exportLayoutAction(): Promise<string> {
  const session = await requireSession();
  const bundle = { kind: "holdall-layout", version: 1, layout: getUserLayout(session.user.id), theme: getUserTheme(session.user.id) };
  return JSON.stringify(bundle, null, 2);
}

export async function importLayoutAction(json: string): Promise<{ error?: string }> {
  const session = await requireSession();
  let parsed;
  try {
    parsed = bundleSchema.safeParse(JSON.parse(json));
  } catch {
    return { error: "invalid" };
  }
  if (!parsed.success) return { error: "invalid" };
  saveUserLayout(session.user.id, parsed.data.layout);
  saveUserTheme(session.user.id, parsed.data.theme.mode, parsed.data.theme.mode === "custom" ? parsed.data.theme.theme : undefined);
  revalidatePath("/", "layout");
  return {};
}
