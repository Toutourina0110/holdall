import path from "node:path";
import { z } from "zod";

export type Env = {
  dataDir: string;
  port: number;
  appUrl: string;
  appSecret: string;
  allowRegistration: boolean;
  trustProxy: boolean;
  trustProxyHeader: "auto" | "cf-connecting-ip" | "x-real-ip" | "x-forwarded-for";
  demoMode: boolean;
  demoResetMinutes: number;
  maxConcurrentJobs: number;
  maxUploadMb: number;
  pluginRegistryUrl: string;
  ytdlpAutoUpdate: boolean;
  allowUnsafePlugins: boolean;
  updateCheck: boolean;
  updateWebhookUrl?: string;
  updateWebhookToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  microsoftClientId?: string;
  microsoftClientSecret?: string;
  microsoftTenantId: string;
  oauthRelayUrl?: string;
};

const flag = (fallback: "true" | "false") =>
  z
    .enum(["true", "false", "1", "0", ""])
    .default(fallback)
    .transform((value) => (value === "" ? fallback === "true" : value === "true" || value === "1"));

const optional = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const devSecret = "holdall-development-secret-not-for-production-use";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATA_DIR: z.string().min(1).default("data"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_URL: optional.pipe(z.url().optional()),
  APP_SECRET: optional.pipe(z.string().min(32, "must be at least 32 characters").optional()),
  ALLOW_REGISTRATION: flag("false"),
  TRUST_PROXY: flag("false"),
  TRUST_PROXY_HEADER: z.enum(["auto", "cf-connecting-ip", "x-real-ip", "x-forwarded-for", ""]).default("auto"),
  DEMO_MODE: flag("false"),
  DEMO_RESET_MINUTES: z.coerce.number().int().min(5).default(60),
  MAX_CONCURRENT_JOBS: z.coerce.number().int().min(1).max(32).default(2),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).default(500),
  PLUGIN_REGISTRY_URL: optional.pipe(z.url().optional()),
  YTDLP_AUTO_UPDATE: flag("true"),
  HOLDALL_TARGET: z.string().optional(),
  ALLOW_UNSAFE_PLUGINS: z.enum(["true", "false", "1", "0", ""]).optional(),
  UPDATE_CHECK: flag("true"),
  UPDATE_WEBHOOK_URL: optional.pipe(z.url({ protocol: /^https?$/ }).optional()),
  UPDATE_WEBHOOK_TOKEN: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  MICROSOFT_CLIENT_ID: optional,
  MICROSOFT_CLIENT_SECRET: optional,
  MICROSOFT_TENANT_ID: z.string().default("common"),
  OAUTH_RELAY_URL: z.union([z.literal("off"), z.literal(""), z.url({ protocol: /^https?$/ })]).optional(),
});

export const defaultRelayUrl = "https://auth.holdall.site";

export const defaultRegistryUrl = "https://raw.githubusercontent.com/Toutourina0110/holdall-registry/main/index.json";

export function parseEnv(source: Record<string, string | undefined>, cwd: string): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment variables (${problems}). Check your .env file against .env.example.`);
  }
  const data = result.data;
  if (data.NODE_ENV === "production" && !data.APP_SECRET) {
    throw new Error("Invalid environment variables (APP_SECRET: required in production). Set it in .env, see .env.example.");
  }
  return {
    dataDir: path.resolve(source.INIT_CWD ?? cwd, data.DATA_DIR),
    port: data.PORT,
    appUrl: data.APP_URL ?? `http://localhost:${data.PORT}`,
    appSecret: data.APP_SECRET ?? devSecret,
    allowRegistration: data.ALLOW_REGISTRATION,
    trustProxy: data.TRUST_PROXY,
    trustProxyHeader: data.TRUST_PROXY_HEADER || "auto",
    demoMode: data.DEMO_MODE,
    demoResetMinutes: data.DEMO_RESET_MINUTES,
    maxConcurrentJobs: data.MAX_CONCURRENT_JOBS,
    maxUploadMb: data.MAX_UPLOAD_MB,
    pluginRegistryUrl: data.PLUGIN_REGISTRY_URL ?? defaultRegistryUrl,
    ytdlpAutoUpdate: data.YTDLP_AUTO_UPDATE,
    updateCheck: data.UPDATE_CHECK,
    updateWebhookUrl: data.UPDATE_WEBHOOK_URL,
    updateWebhookToken: data.UPDATE_WEBHOOK_TOKEN,
    allowUnsafePlugins: data.ALLOW_UNSAFE_PLUGINS ? data.ALLOW_UNSAFE_PLUGINS === "true" || data.ALLOW_UNSAFE_PLUGINS === "1" : data.HOLDALL_TARGET === "desktop",
    googleClientId: data.GOOGLE_CLIENT_ID,
    googleClientSecret: data.GOOGLE_CLIENT_SECRET,
    microsoftClientId: data.MICROSOFT_CLIENT_ID,
    microsoftClientSecret: data.MICROSOFT_CLIENT_SECRET,
    microsoftTenantId: data.MICROSOFT_TENANT_ID,
    oauthRelayUrl: data.OAUTH_RELAY_URL === "off" ? undefined : (data.OAUTH_RELAY_URL || defaultRelayUrl).replace(/\/+$/, ""),
  };
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env, process.cwd());
  return cached;
}
