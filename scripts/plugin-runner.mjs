import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const entry = process.argv[2];
const pending = new Map();
const hooks = new Map();
const functions = new Map();
let sequence = 0;

function send(message) {
  if (process.connected) process.send(message);
}

function request(method, params, context) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ type: "api", id, method, params, callId: context?.callId, userId: context?.userId });
  });
}

const holdall = {
  on(hook, handler) {
    hooks.set(hook, handler);
    send({ type: "hook.register", hook });
  },
  handle(name, handler) {
    functions.set(name, handler);
    send({ type: "fn.register", name });
  },
  users() {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      send({ type: "users", id });
    });
  },
  as(userId) {
    return { userId };
  },
  sharedDir() {
    if (!process.env.HOLDALL_PLUGIN_DATA) throw new Error("The plugin was not granted the storage permission.");
    return path.join(process.env.HOLDALL_PLUGIN_DATA, "shared");
  },
  userDir(context) {
    if (!process.env.HOLDALL_PLUGIN_DATA) throw new Error("The plugin was not granted the storage permission.");
    const userId = String(context?.userId ?? "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) throw new Error("Pass the context of a person to get their folder.");
    const dir = path.join(process.env.HOLDALL_PLUGIN_DATA, "users", userId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },
  push(userId, event, data) {
    send({ type: "push", userId, event, data });
  },
  api(method, params, context) {
    return request(method, params, context);
  },
  storage: {
    get: (key, context) => request("storage.get", { key }, context),
    set: (key, value, context) => request("storage.set", { key, value }, context),
    delete: (key, context) => request("storage.delete", { key }, context),
  },
  fetch: (url, init, context) => request("network.fetch", { url, ...init }, context),
  log: (message) => send({ type: "log", message: String(message).slice(0, 2000) }),
};

process.on("message", async (message) => {
  if (message?.type === "api.result") {
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error));
    else call.resolve(message.result);
    return;
  }
  if (message?.type === "hook.call" || message?.type === "fn.call") {
    const handler = message.type === "hook.call" ? hooks.get(message.hook) : functions.get(message.name);
    try {
      if (!handler) throw new Error(`No handler for ${message.hook ?? message.name}.`);
      const result = await handler(message.payload, { userId: message.userId, callId: message.callId });
      send({ type: "hook.result", id: message.id, result });
    } catch (error) {
      send({ type: "hook.result", id: message.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
});

try {
  const plugin = await import(pathToFileURL(entry).href);
  if (typeof plugin.default === "function") await plugin.default(holdall);
  send({ type: "ready" });
} catch (error) {
  send({ type: "fatal", error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
}
