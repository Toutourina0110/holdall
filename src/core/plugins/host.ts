import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { getEnv } from "@/core/env";
import { createLogger } from "@/core/log";
import { safeJoin } from "@/core/paths";
import { callPluginApi } from "./api";
import { installedDir } from "./install";
import { pushToUser } from "./live";
import { isUnsafePermission } from "./permissions";
import { getInstalledPlugin, isPluginEnabledFor, listInstalledPlugins, usersWithPlugin } from "./store";

type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };

type PluginProcess = {
  child: ChildProcess;
  ready: Promise<void>;
  hooks: Set<string>;
  functions: Set<string>;
  pending: Map<number, Pending>;
  calls: Map<string, string>;
  sequence: number;
  stopped?: boolean;
};

function callerOf(proc: PluginProcess, pluginId: string, message: Record<string, unknown>): string | undefined {
  const fromCall = message.callId ? proc.calls.get(String(message.callId)) : undefined;
  if (fromCall) return fromCall;
  const userId = typeof message.userId === "string" ? message.userId : undefined;
  if (!userId || !getInstalledPlugin(pluginId)?.granted.has("background") || !isPluginEnabledFor(userId, pluginId)) return undefined;
  return userId;
}

const restarts = new Map<string, { attempts: number; timer?: ReturnType<typeof setTimeout> }>();

function runsInBackground(pluginId: string): boolean {
  const installed = getInstalledPlugin(pluginId);
  return Boolean(installed?.manifest.entry.server && installed.granted.has("background") && usersWithPlugin(pluginId).length > 0);
}

function scheduleRestart(pluginId: string): void {
  if (!runsInBackground(pluginId)) return;
  const state = restarts.get(pluginId) ?? { attempts: 0 };
  if (state.timer) return;
  const delay = Math.min(5000 * 2 ** state.attempts, 5 * 60 * 1000);
  state.attempts += 1;
  state.timer = setTimeout(() => {
    state.timer = undefined;
    ensureBackgroundPlugin(pluginId);
  }, delay);
  state.timer.unref?.();
  restarts.set(pluginId, state);
  log.warn("Background plugin stopped, starting it again soon", { pluginId, seconds: Math.round(delay / 1000) });
}

export function ensureBackgroundPlugin(pluginId: string): void {
  if (!runsInBackground(pluginId)) return;
  const proc = startPluginProcess(pluginId);
  proc?.ready.then(() => restarts.delete(pluginId)).catch(() => undefined);
}

export function startBackgroundPlugins(): void {
  for (const installed of listInstalledPlugins()) ensureBackgroundPlugin(installed.id);
}

const globalKey = Symbol.for("holdall.pluginHost");
const store = globalThis as unknown as Record<symbol, Map<string, PluginProcess> | undefined>;
const processes: Map<string, PluginProcess> = (store[globalKey] ??= new Map());
const log = createLogger("plugins");

export class PluginCallError extends Error {}

export function runnerPath(): string {
  return path.join(process.env.HOLDALL_ROOT ?? process.cwd(), "scripts", "plugin-runner.mjs");
}

export function nodeFlags(dir: string, runner: string, has: (permission: string) => boolean): string[] {
  if (has("system")) return [];
  return [
    "--permission",
    `--allow-fs-read=${dir}`,
    `--allow-fs-read=${runner}`,
    "--max-old-space-size=512",
    ...(has("fs:host") ? ["--allow-fs-read=*", "--allow-fs-write=*", "--allow-wasi"] : []),
    ...(has("process:spawn") ? ["--allow-child-process", "--allow-worker"] : []),
    ...(has("network:direct") ? ["--allow-net"] : []),
  ];
}

function hostEnv(): NodeJS.ProcessEnv {
  const keep = ["PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR", "HOME", "USERPROFILE", "TEMP", "TMP", "LANG", "TZ"];
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV ?? "production" };
  for (const name of keep) if (process.env[name]) env[name] = process.env[name]!;
  return env;
}

export function startPluginProcess(pluginId: string): PluginProcess | undefined {
  const existing = processes.get(pluginId);
  if (existing && existing.child.exitCode === null) return existing;
  const installed = getInstalledPlugin(pluginId);
  const serverEntry = installed?.manifest.entry.server;
  if (!installed || !serverEntry) return undefined;
  const dir = installedDir(pluginId);
  const entry = safeJoin(dir, serverEntry);
  const runner = runnerPath();
  const has = (permission: string) => installed.granted.has(permission) && (getEnv().allowUnsafePlugins || !isUnsafePermission(permission));
  const env: NodeJS.ProcessEnv = has("system") || has("process:spawn") ? hostEnv() : { NODE_ENV: process.env.NODE_ENV ?? "production" };
  const child: ChildProcess = spawn(process.execPath, [...nodeFlags(dir, runner, has), runner, entry], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env,
    windowsHide: true,
  });
  const proc: PluginProcess = { child, hooks: new Set(), functions: new Set(), pending: new Map(), calls: new Map(), sequence: 0, ready: Promise.resolve() };
  proc.ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${pluginId} did not start in time.`)), 10000);
    child.on("message", async (message: Record<string, unknown>) => {
      switch (message.type) {
        case "ready":
          clearTimeout(timer);
          resolve();
          break;
        case "fatal":
          clearTimeout(timer);
          reject(new Error(String(message.error)));
          break;
        case "log":
          log.info(`[${pluginId}] ${String(message.message)}`);
          break;
        case "hook.register": {
          const hook = String(message.hook);
          if (installed.granted.has(`hooks:${hook}`)) proc.hooks.add(hook);
          else log.warn("Plugin tried to use a hook it was not granted", { pluginId, hook });
          break;
        }
        case "fn.register": {
          const name = String(message.name);
          if (/^[A-Za-z0-9_.:-]{1,80}$/.test(name)) proc.functions.add(name);
          break;
        }
        case "push": {
          const userId = String(message.userId);
          const event = String(message.event).slice(0, 80);
          let size = 0;
          try {
            size = JSON.stringify(message.data ?? null).length;
          } catch {
            break;
          }
          if (size > 64 * 1024) log.warn("Plugin push is larger than 64 KB and was dropped", { pluginId });
          else if (isPluginEnabledFor(userId, pluginId)) pushToUser(pluginId, userId, { event, data: message.data ?? null });
          break;
        }
        case "hook.result": {
          const call = proc.pending.get(Number(message.id));
          if (!call) break;
          proc.pending.delete(Number(message.id));
          clearTimeout(call.timer);
          if (message.error) call.reject(new PluginCallError(String(message.error).slice(0, 500)));
          else call.resolve(message.result);
          break;
        }
        case "users": {
          const allowed = getInstalledPlugin(pluginId)?.granted.has("background");
          if (child.connected) {
            child.send({
              type: "api.result",
              id: message.id,
              ...(allowed ? { result: usersWithPlugin(pluginId) } : { error: "The plugin was not granted the background permission." }),
            });
          }
          break;
        }
        case "api": {
          const userId = callerOf(proc, pluginId, message);
          let reply: { result?: unknown; error?: string };
          if (!userId) reply = { error: "API calls are only allowed while Holdall is calling the plugin, or with the background permission for a person who turned it on." };
          else {
            try {
              reply = { result: await callPluginApi(String(message.method), message.params, { pluginId, userId }) };
            } catch (error) {
              reply = { error: error instanceof Error ? error.message : String(error) };
            }
          }
          if (child.connected) child.send({ type: "api.result", id: message.id, ...reply });
          break;
        }
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`${pluginId} stopped with code ${code}.`));
      for (const call of proc.pending.values()) {
        clearTimeout(call.timer);
        call.reject(new Error(`${pluginId} stopped.`));
      }
      proc.pending.clear();
      if (processes.get(pluginId) === proc) processes.delete(pluginId);
      if (!proc.stopped) scheduleRestart(pluginId);
    });
  });
  proc.ready.catch((error: Error) => log.warn("Plugin process failed", { pluginId, error: error.message }));
  child.stderr?.on("data", (chunk: Buffer) => log.warn(`[${pluginId}] ${chunk.toString().slice(0, 2000)}`));
  child.stdout?.on("data", (chunk: Buffer) => log.info(`[${pluginId}] ${chunk.toString().slice(0, 2000)}`));
  processes.set(pluginId, proc);
  return proc;
}

async function invoke(pluginId: string, kind: "hook" | "fn", name: string, payload: unknown, userId: string, timeoutMs: number): Promise<unknown> {
  const proc = startPluginProcess(pluginId);
  if (!proc) throw new Error(`${pluginId} has no server code.`);
  await proc.ready;
  if (kind === "hook" && !proc.hooks.has(name)) return undefined;
  if (kind === "fn" && !proc.functions.has(name)) throw new PluginCallError(`The plugin has no server function named ${name}.`);
  const id = ++proc.sequence;
  const callId = randomUUID();
  proc.calls.set(callId, userId);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        proc.pending.delete(id);
        reject(new PluginCallError(`${pluginId} took too long to answer ${name}.`));
      }, timeoutMs);
      proc.pending.set(id, { resolve, reject, timer });
      proc.child.send({ type: kind === "hook" ? "hook.call" : "fn.call", id, hook: name, name, payload, userId, callId });
    });
  } finally {
    proc.calls.delete(callId);
  }
}


export function callPluginHook(pluginId: string, hook: string, payload: unknown, userId: string, timeoutMs = 5000): Promise<unknown> {
  return invoke(pluginId, "hook", hook, payload, userId, timeoutMs);
}

export function callPluginFunction(pluginId: string, name: string, args: unknown, userId: string, timeoutMs = 30000): Promise<unknown> {
  return invoke(pluginId, "fn", name, args, userId, timeoutMs);
}

export async function pluginHooks(pluginId: string): Promise<Set<string>> {
  const proc = startPluginProcess(pluginId);
  if (!proc) return new Set();
  await proc.ready.catch(() => undefined);
  return proc.hooks;
}

export function stopPluginProcess(pluginId: string): void {
  const proc = processes.get(pluginId);
  if (proc) {
    proc.stopped = true;
    proc.child.kill();
  }
  processes.delete(pluginId);
  const restart = restarts.get(pluginId);
  if (restart?.timer) clearTimeout(restart.timer);
  restarts.delete(pluginId);
}

export function stopAllPluginProcesses(): void {
  for (const id of [...processes.keys()]) stopPluginProcess(id);
}
