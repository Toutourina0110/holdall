export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { settingsError } = await import("@/core/settings");
  const problem = settingsError(process.env, process.cwd());
  const { createLogger } = await import("@/core/log");
  if (problem) {
    createLogger("boot").error(problem);
    process.exit(1);
  }
  const { getEnv } = await import("@/core/env");
  const { startJobWorker } = await import("@/core/jobs/queue");
  await import("@/modules/register");
  startJobWorker({ concurrency: getEnv().maxConcurrentJobs });
}
