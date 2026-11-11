"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireSession } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { deleteJob, enqueueJob } from "@/core/jobs/queue";
import { checkLink, downloadOptionsSchema, parseLinks } from "@/modules/downloader/args";
import { canManageTools } from "@/modules/downloader/tools";
import { assertPublicUrl } from "@/core/security/safe-fetch";

type Result<T = object> = T | { error: string };

function failure(error: unknown): { error: string } {
  if (error instanceof UserFacingError) return { error: error.message };
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check the options and try again." };
  return { error: "Something went wrong. Try again in a moment." };
}

function refuseInDemo() {
  if (getEnv().demoMode) throw new UserFacingError("Downloads are turned off on the demo instance.");
}

export async function probeLinksAction(text: string): Promise<Result<{ ids: string[] }>> {
  const session = await requireSession();
  try {
    refuseInDemo();
    const links = parseLinks(String(text));
    for (const url of links) await assertPublicUrl(url);
    const ids = links.map((url) => enqueueJob({ userId: session.user.id, type: "downloader.probe", payload: { url }, maxAttempts: 1 }));
    return { ids };
  } catch (error) {
    return failure(error);
  }
}

export async function startDownloadsAction(items: { url: string; title?: string }[], options: unknown): Promise<Result<{ count: number }>> {
  const session = await requireSession();
  try {
    refuseInDemo();
    const parsed = downloadOptionsSchema.parse(options);
    const list = z
      .array(z.object({ url: z.string().max(2000), title: z.string().max(300).optional() }))
      .min(1)
      .max(500)
      .parse(items);
    for (const item of list.slice(0, 1)) await assertPublicUrl(item.url);
    for (const item of list) {
      enqueueJob({ userId: session.user.id, type: "downloader.download", payload: { url: checkLink(item.url), title: item.title, options: parsed }, maxAttempts: 2 });
    }
    revalidatePath("/downloads");
    return { count: list.length };
  } catch (error) {
    return failure(error);
  }
}

export async function removeDownloadAction(id: string): Promise<Result> {
  const session = await requireSession();
  if (!deleteJob(session.user.id, String(id))) return { error: "Pause the download before removing it." };
  return {};
}

export async function updateToolsAction(): Promise<Result<{ id: string }>> {
  const session = await requireAdmin();
  if (!canManageTools()) return { error: "yt-dlp is managed by the Docker image on this server. Update the image instead." };
  return { id: enqueueJob({ userId: session.user.id, type: "downloader.tools", payload: {}, maxAttempts: 1 }) };
}
