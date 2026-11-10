export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { settingsError } = await import("@/core/settings");
  const problem = settingsError(process.env, process.cwd());
  if (!problem) return;
  const { createLogger } = await import("@/core/log");
  createLogger("boot").error(problem);
  process.exit(1);
}
