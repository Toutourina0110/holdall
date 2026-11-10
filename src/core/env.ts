import path from "node:path";
import { z } from "zod";

export type Env = { dataDir: string; port: number };

const envSchema = z.object({
  DATA_DIR: z.string().min(1).default("data"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export function parseEnv(source: Record<string, string | undefined>, cwd: string): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables (${problems}). Check your .env file against .env.example.`);
  }
  return {
    dataDir: path.resolve(source.INIT_CWD ?? cwd, result.data.DATA_DIR),
    port: result.data.PORT,
  };
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env, process.cwd());
  return cached;
}
