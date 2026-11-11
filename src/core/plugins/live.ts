import { EventEmitter } from "node:events";

type LiveMessage = { event: string; data: unknown };

const globalKey = Symbol.for("holdall.pluginLive");
const store = globalThis as unknown as Record<symbol, EventEmitter | undefined>;
const emitter: EventEmitter = (store[globalKey] ??= new EventEmitter().setMaxListeners(0));

function channel(pluginId: string, userId: string) {
  return `${pluginId}\u0000${userId}`;
}

export function pushToUser(pluginId: string, userId: string, message: LiveMessage): void {
  emitter.emit(channel(pluginId, userId), message);
}

export function onPluginEvent(pluginId: string, userId: string, listener: (message: LiveMessage) => void): () => void {
  emitter.on(channel(pluginId, userId), listener);
  return () => emitter.off(channel(pluginId, userId), listener);
}
