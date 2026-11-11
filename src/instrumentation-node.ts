import { settingsError } from "@/core/settings";
import { createLogger } from "@/core/log";
import { getEnv } from "@/core/env";
import { startJobWorker } from "@/core/jobs/queue";
import { autoUpdateTools } from "@/modules/downloader/jobs";
import { startCalendarScheduler } from "@/modules/calendar/sync";
import { startDemoReset } from "@/modules/demo/demo";
import { startBackgroundPlugins } from "@/core/plugins/host";
import "@/modules/register";

export function boot(): void {
  const problem = settingsError(process.env, process.cwd());
  if (problem) {
    createLogger("boot").error(problem);
    process.exit(1);
  }
  startJobWorker({ concurrency: getEnv().maxConcurrentJobs });
  void autoUpdateTools();
  startCalendarScheduler();
  startDemoReset();
  startBackgroundPlugins();
}
