import { createLogger } from "@/core/log";
import { callPluginHook, pluginHooks } from "./host";
import { hookCatalog, type HookName } from "./permissions";
import { pluginsEnabledFor } from "./store";

type HookContext = { userId: string };
type CoreAction = (payload: unknown, context: HookContext) => Promise<void> | void;
type CoreFilter = (value: unknown, context: HookContext) => Promise<unknown> | unknown;

const globalKey = Symbol.for("holdall.hooks");
const store = globalThis as unknown as Record<symbol, { actions: Map<string, CoreAction[]>; filters: Map<string, CoreFilter[]> } | undefined>;
const registry = (store[globalKey] ??= { actions: new Map(), filters: new Map() });
const log = createLogger("hooks");

export function addAction(hook: HookName, handler: CoreAction): void {
  registry.actions.set(hook, [...(registry.actions.get(hook) ?? []), handler]);
}

export function addFilter(hook: HookName, handler: CoreFilter): void {
  registry.filters.set(hook, [...(registry.filters.get(hook) ?? []), handler]);
}

async function listeningPlugins(hook: HookName, userId: string): Promise<string[]> {
  const required = hookCatalog[hook].permission;
  const plugins = pluginsEnabledFor(userId).filter(
    (item) => item.manifest.entry.server && item.granted.has(`hooks:${hook}`) && item.granted.has(required),
  );
  const listening: string[] = [];
  for (const item of plugins) {
    if ((await pluginHooks(item.id)).has(hook)) listening.push(item.id);
  }
  return listening;
}

export async function doAction(hook: HookName, payload: unknown, context: HookContext): Promise<void> {
  for (const handler of registry.actions.get(hook) ?? []) await handler(payload, context);
  const plugins = await listeningPlugins(hook, context.userId);
  const results = await Promise.allSettled(plugins.map((pluginId) => callPluginHook(pluginId, hook, payload, context.userId)));
  results.forEach((result, index) => {
    if (result.status === "rejected") log.warn("Plugin action failed", { pluginId: plugins[index], hook, error: String(result.reason) });
  });
}

export async function applyFilters<T>(hook: HookName, value: T, context: HookContext, validate: (next: unknown) => next is T): Promise<T> {
  let current = value;
  for (const handler of registry.filters.get(hook) ?? []) {
    const next = await handler(current, context);
    if (validate(next)) current = next;
  }
  for (const pluginId of await listeningPlugins(hook, context.userId)) {
    try {
      const next = await callPluginHook(pluginId, hook, current, context.userId);
      if (validate(next)) current = next;
      else log.warn("Plugin filter returned an invalid value", { pluginId, hook });
    } catch (error) {
      log.warn("Plugin filter failed", { pluginId, hook, error: String(error) });
    }
  }
  return current;
}
