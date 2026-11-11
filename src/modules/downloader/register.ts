import { registerSlotContributor } from "@/core/layout/registry";
import { registerPluginApi } from "@/core/plugins/api";
import { listJobs } from "@/core/jobs/queue";
import { z } from "zod";
import "./jobs";

registerSlotContributor("downloader", () => [
  { id: "downloader.page", slot: "rail.media", label: "Downloads", icon: "downloads", href: "/downloads", order: 10, source: "downloader" },
  { id: "downloader.queue", slot: "dashboard.widgets", label: "Downloads", icon: "downloads", order: 30, source: "downloader", builtin: { component: "downloads.queue", width: 1 } },
]);

registerPluginApi("downloads.list", "downloads:read", z.object({}), (_params, { userId }) =>
  listJobs(userId, "downloader.download").map((job) => ({ id: job.id, status: job.status, progress: job.progress, result: job.result ? JSON.parse(job.result) : null })),
);
