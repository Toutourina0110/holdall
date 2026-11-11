import { registerSlotContributor } from "@/core/layout/registry";
import { registerPluginApi } from "@/core/plugins/api";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { enqueueJob, listJobs } from "@/core/jobs/queue";
import { assertPublicUrl } from "@/core/security/safe-fetch";
import { checkLink, downloadOptionsSchema } from "./args";
import { z } from "zod";
import "./jobs";

registerSlotContributor("downloader", () => [
  { id: "downloader.page", slot: "rail.media", label: "Downloads", icon: "downloads", href: "/downloads", order: 10, source: "downloader" },
  { id: "downloader.queue", slot: "dashboard.widgets", label: "Downloads", icon: "downloads", order: 30, source: "downloader", builtin: { component: "downloads.queue", width: 1 } },
]);

registerPluginApi("downloads.list", "downloads:read", z.object({}), (_params, { userId }) =>
  listJobs(userId, "downloader.download").map((job) => ({ id: job.id, status: job.status, progress: job.progress, result: job.result ? JSON.parse(job.result) : null })),
);

registerPluginApi(
  "downloads.create",
  "downloads:create",
  z.object({ url: z.string().max(2000), title: z.string().max(300).optional(), options: downloadOptionsSchema.prefault({ kind: "video" }) }),
  async ({ url, title, options }, { userId }) => {
    if (getEnv().demoMode) throw new UserFacingError("Downloads are turned off on the demo instance.");
    const link = checkLink(url);
    await assertPublicUrl(link);
    return { id: enqueueJob({ userId, type: "downloader.download", payload: { url: link, title, options }, maxAttempts: 2 }) };
  },
);
