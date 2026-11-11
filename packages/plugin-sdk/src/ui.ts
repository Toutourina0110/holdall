import type { MethodName, Methods } from "./index";

type Waiting = { resolve: (value: unknown) => void; reject: (error: Error) => void };

export type Client = <M extends MethodName>(method: M, params?: Methods[M]["params"]) => Promise<Methods[M]["result"]>;

export function createClient(timeoutMs = 15000): Client {
  let next = 0;
  const waiting = new Map<number, Waiting>();
  addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; id?: number; result?: unknown; error?: string } | null;
    if (event.source !== parent || data?.type !== "holdall:response" || typeof data.id !== "number") return;
    const call = waiting.get(data.id);
    if (!call) return;
    waiting.delete(data.id);
    if (data.error) call.reject(new Error(data.error));
    else call.resolve(data.result);
  });
  return (method, params) => {
    const id = ++next;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
      setTimeout(() => {
        if (waiting.delete(id)) reject(new Error(`${method} took too long to answer.`));
      }, timeoutMs);
      parent.postMessage({ type: "holdall:request", id, method, params }, "*");
    });
  };
}

export async function applyTheme(call: Client): Promise<void> {
  const tokens = await call("theme.tokens");
  for (const [name, value] of Object.entries(tokens)) document.documentElement.style.setProperty(name, value);
}

export function callServer<R = unknown>(call: Client, name: string, args?: unknown): Promise<R> {
  return call("server.call", { name, args }) as Promise<R>;
}

export async function onEvent(call: Client, handler: (event: string, data: unknown) => void): Promise<void> {
  addEventListener("message", (message: MessageEvent) => {
    const data = message.data as { type?: string; event?: string; data?: unknown } | null;
    if (message.source !== parent || data?.type !== "holdall:event" || typeof data.event !== "string") return;
    handler(data.event, data.data);
  });
  await call("events.subscribe");
}
