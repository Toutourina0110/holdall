import { eq } from "drizzle-orm";
import { getDb } from "@/core/db/client";
import { appSetting } from "@/core/db/schema";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { createLogger } from "@/core/log";
import { isNewerVersion } from "@/core/plugins/manifest";
import { appVersion } from "@/core/plugins/install";
import { safeFetch } from "@/core/security/safe-fetch";
import { isDesktop } from "@/core/target";

const log = createLogger("updates");
const releasesUrl = "https://api.github.com/repos/Toutourina0110/holdall/releases/latest";
const settingKey = "update.latest";
const dayMs = 24 * 60 * 60 * 1000;

export type AvailableUpdate = { version: string; url: string };

function updatesEnabled(): boolean {
  const env = getEnv();
  return env.updateCheck && !env.demoMode && !isDesktop();
}

export function parseRelease(body: unknown): AvailableUpdate | undefined {
  if (!body || typeof body !== "object") return undefined;
  const release = body as { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown };
  if (typeof release.tag_name !== "string" || typeof release.html_url !== "string" || release.draft || release.prerelease) return undefined;
  const version = release.tag_name.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version) || !release.html_url.startsWith("https://github.com/")) return undefined;
  return { version, url: release.html_url };
}

export async function checkForUpdate(): Promise<AvailableUpdate | undefined> {
  const response = await safeFetch(releasesUrl, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Holdall" },
    maxBytes: 512 * 1024,
    timeoutMs: 15000,
  });
  if (response.status !== 200) throw new Error(`GitHub answered ${response.status}.`);
  const latest = parseRelease(JSON.parse(response.body.toString("utf8")));
  if (!latest) return undefined;
  getDb()
    .insert(appSetting)
    .values({ key: settingKey, value: JSON.stringify(latest) })
    .onConflictDoUpdate({ target: appSetting.key, set: { value: JSON.stringify(latest) } })
    .run();
  return latest;
}

export function availableUpdate(current = appVersion): AvailableUpdate | undefined {
  if (!updatesEnabled()) return undefined;
  const row = getDb().select().from(appSetting).where(eq(appSetting.key, settingKey)).get();
  if (!row) return undefined;
  try {
    const latest = JSON.parse(row.value) as AvailableUpdate;
    return isNewerVersion(latest.version, current) ? latest : undefined;
  } catch {
    return undefined;
  }
}

export function canUpdateFromHoldall(): boolean {
  return Boolean(getEnv().updateWebhookUrl);
}

export async function triggerUpdate(): Promise<void> {
  const env = getEnv();
  if (!env.updateWebhookUrl) throw new UserFacingError("No update webhook is set. Run the update command on the server instead.");
  const headers: Record<string, string> = { "User-Agent": "Holdall" };
  if (env.updateWebhookToken) headers.Authorization = `Bearer ${env.updateWebhookToken}`;
  let response: Response;
  try {
    response = await fetch(env.updateWebhookUrl, { method: "GET", headers, signal: AbortSignal.timeout(20000), redirect: "manual" });
  } catch (error) {
    log.warn("Update webhook could not be reached", { error: String(error) });
    throw new UserFacingError("The update webhook could not be reached. Check UPDATE_WEBHOOK_URL.");
  }
  if (!response.ok) {
    log.warn("Update webhook refused the call", { status: response.status });
    throw new UserFacingError(`The update webhook answered ${response.status}. Check UPDATE_WEBHOOK_URL and UPDATE_WEBHOOK_TOKEN.`);
  }
}

const timerKey = Symbol.for("holdall.updateCheck");
const store = globalThis as unknown as Record<symbol, ReturnType<typeof setInterval> | undefined>;

export function startUpdateChecks(): void {
  if (store[timerKey] || !updatesEnabled()) return;
  const tick = () => {
    checkForUpdate().catch((error) => log.warn("Update check failed", { error: String(error) }));
  };
  store[timerKey] = setInterval(tick, dayMs);
  store[timerKey].unref?.();
  setTimeout(tick, 60000).unref?.();
}
