import { parseEnv } from "./env.ts";
import { parseTarget } from "./target.ts";

export function settingsError(source: Record<string, string | undefined>, cwd: string): string | undefined {
  try {
    parseEnv(source, cwd);
    parseTarget(source.HOLDALL_TARGET);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
