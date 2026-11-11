import { z } from "zod";
import { UserFacingError } from "@/core/errors";
import { addNotification } from "@/core/notifications/store";
import { safeFetch } from "@/core/security/safe-fetch";
import { deletePluginStorage, getInstalledPlugin, isPluginEnabledFor, readPluginStorage, writePluginStorage } from "./store";

export type PluginCallContext = { pluginId: string; userId: string };

type ApiMethod = {
  permission: string | null;
  params: z.ZodType;
  run(params: never, context: PluginCallContext): Promise<unknown> | unknown;
};

const methods = new Map<string, ApiMethod>();

export function registerPluginApi<T extends z.ZodType>(
  name: string,
  permission: string | null,
  params: T,
  run: (params: z.infer<T>, context: PluginCallContext) => Promise<unknown> | unknown,
): void {
  methods.set(name, { permission, params, run: run as ApiMethod["run"] });
}

export class PluginPermissionError extends UserFacingError {}

export async function callPluginApi(name: string, rawParams: unknown, context: PluginCallContext): Promise<unknown> {
  const method = methods.get(name);
  if (!method) throw new PluginPermissionError(`Unknown plugin API method ${name}.`);
  const installed = getInstalledPlugin(context.pluginId);
  if (!installed) throw new PluginPermissionError("This plugin is not installed.");
  if (!isPluginEnabledFor(context.userId, context.pluginId)) throw new PluginPermissionError("This plugin is turned off for this user.");
  if (method.permission && !installed.granted.has(method.permission)) {
    throw new PluginPermissionError(`The plugin was not granted the ${method.permission} permission.`);
  }
  const params = method.params.safeParse(rawParams);
  if (!params.success) throw new PluginPermissionError(`Invalid parameters for ${name}.`);
  return method.run(params.data as never, context);
}

const storageKey = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.:-]+$/);

registerPluginApi("storage.get", "storage", z.object({ key: storageKey }), ({ key }, context) =>
  readPluginStorage(context.pluginId, context.userId, key),
);

registerPluginApi("storage.set", "storage", z.object({ key: storageKey, value: z.unknown() }), ({ key, value }, context) => {
  writePluginStorage(context.pluginId, context.userId, key, value);
  return true;
});

registerPluginApi("storage.delete", "storage", z.object({ key: storageKey }), ({ key }, context) => {
  deletePluginStorage(context.pluginId, context.userId, key);
  return true;
});

registerPluginApi(
  "network.fetch",
  null,
  z.object({
    url: z.url(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().max(1024 * 1024).optional(),
  }),
  async ({ url, method, headers, body }, context) => {
    const installed = getInstalledPlugin(context.pluginId)!;
    const anyHost = installed.granted.has("network:any") || installed.granted.has("network:local");
    const local = installed.granted.has("network:local");
    if (!anyHost && !installed.granted.has("network")) throw new PluginPermissionError("The plugin was not granted the network permission.");
    const target = new URL(url);
    if (target.protocol !== "https:" && !(anyHost && target.protocol === "http:")) throw new PluginPermissionError("Plugins can only use https addresses.");
    if (!anyHost && !installed.manifest.network.includes(target.hostname)) {
      throw new PluginPermissionError(`The plugin did not declare ${target.hostname} in its network list.`);
    }
    const forwarded = Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => !/^(cookie|host|authorization-holdall)$/i.test(name)));
    const response = await safeFetch(target.toString(), {
      method,
      headers: forwarded,
      body,
      maxBytes: anyHost ? 20 * 1024 * 1024 : 2 * 1024 * 1024,
      timeoutMs: anyHost ? 60000 : 15000,
      allowHttp: anyHost,
      allowPrivate: local,
      redirects: anyHost ? 5 : 0,
    });
    return { status: response.status, headers: response.headers, body: response.body.toString("utf8") };
  },
);

registerPluginApi(
  "notifications.show",
  "notifications",
  z.object({ title: z.string().trim().min(1).max(120), body: z.string().max(500).optional() }),
  ({ title, body }, context) => {
    const installed = getInstalledPlugin(context.pluginId)!;
    addNotification(context.userId, installed.manifest.name, title, body ?? "");
    return true;
  },
);
