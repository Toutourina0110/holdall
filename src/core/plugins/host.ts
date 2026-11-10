import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createLogger } from "@/core/log";
import { safeJoin } from "@/core/paths";
import { callPluginApi } from "./api";
import { installedDir } from "./install";
import { getInstalledPlugin } from "./store";

type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };

type PluginProcess = {
  child: ChildProcess;
  ready: Promise<void>;
  hooks: Set<string>;
  pending: Map<number, Pending>;
  calls: Map<string, string>;
  sequence: number;
};

const globalKey = Symbol.for("holdall.pluginHost");
const store = globalThis as unknown as Record<symbol, Map<string, PluginProcess> | undefined>;
const processes: Map<string, PluginProcess> = (store[globalKey] ??= new Map());
const log = createLogger("plugins");

export function runnerPath(): string {
  return path.join(process.env.HOLDALL_ROOT ?? process.cwd(), "scripts", "plugin-runner.mjs");
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
  const child = spawn(
    process.execPath,
    ["--permission", `--allow-fs-read=${dir}`, `--allow-fs-read=${runner}`, "--max-old-space-size=128", "--disallow-code-generation-from-strings", runner, entry],
    { cwd: dir, stdio: ["ignore", "pipe", "pipe", "ipc"], env: { NODE_ENV: process.env.NODE_ENV ?? "production" }, windowsHide: true },
  );
  const proc: PluginProcess = { child, hooks: new Set(), pending: new Map(), calls: new Map(), sequence: 0, ready: Promise.resolve() };
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
        case "hook.result": {
          const call = proc.pending.get(Number(message.id));
          if (!call) break;
          proc.pending.delete(Number(message.id));
          clearTimeout(call.timer);
          if (message.error) call.reject(new Error(String(message.error)));
          else call.resolve(message.result);
          break;
        }
        case "api": {
          const userId = proc.calls.get(String(message.callId));
          let reply: { result?: unknown; error?: string };
          if (!userId) reply = { error: "API calls are only allowed while Holdall is calling the plugin." };
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
      processes.delete(pluginId);
    });
  });
  proc.ready.catch((error: Error) => log.warn("Plugin process failed", { pluginId, error: error.message }));
  child.stderr?.on("data", (chunk: Buffer) => log.warn(`[${pluginId}] ${chunk.toString().slice(0, 2000)}`));
  child.stdout?.on("data", (chunk: Buffer) => log.info(`[${pluginId}] ${chunk.toString().slice(0, 2000)}`));
  processes.set(pluginId, proc);
  return proc;
}

export async function callPluginHook(pluginId: string, hook: string, payload: unknown, userId: string, timeoutMs = 5000): Promise<unknown> {
  const proc = startPluginProcess(pluginId);
  if (!proc) throw new Error(`${pluginId} has no server code.`);
  await proc.ready;
  if (!proc.hooks.has(hook)) return undefined;
  const id = ++proc.sequence;
  const callId = randomUUID();
  proc.calls.set(callId, userId);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        proc.pending.delete(id);
        reject(new Error(`${pluginId} took too long to answer ${hook}.`));
      }, timeoutMs);
      proc.pending.set(id, { resolve, reject, timer });
      proc.child.send({ type: "hook.call", id, hook, payload, userId, callId });
    });
  } finally {
    proc.calls.delete(callId);
  }
}

export async function pluginHooks(pluginId: string): Promise<Set<string>> {
  const proc = startPluginProcess(pluginId);
  if (!proc) return new Set();
  await proc.ready.catch(() => undefined);
  return proc.hooks;
}

export function stopPluginProcess(pluginId: string): void {
  const proc = processes.get(pluginId);
  if (proc) proc.child.kill();
  processes.delete(pluginId);
}

export function stopAllPluginProcesses(): void {
  for (const id of [...processes.keys()]) stopPluginProcess(id);
}
