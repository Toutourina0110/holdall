"use client";

import { useEffect, useRef } from "react";
import styles from "./PluginFrame.module.css";

const themeTokens = [
  "--color-ground", "--color-surface", "--color-raised", "--color-ink", "--color-text", "--color-muted", "--color-line",
  "--color-line-strong", "--color-accent", "--color-accent-fill", "--color-accent-soft", "--color-accent-text", "--color-on-accent",
  "--color-done", "--color-late", "--color-warn", "--radius-control", "--radius-panel", "--space-2", "--space-3", "--space-4", "--text-ui", "--text-sm",
];

type BridgeRequest = { type: "holdall:request"; id: number; method: string; params?: unknown };

function readTheme(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(themeTokens.map((token) => [token, style.getPropertyValue(token).trim()]));
}

export function PluginFrame({ pluginId, entry, title, tall }: { pluginId: string; entry: string; title: string; tall?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let events: EventSource | undefined;
    async function onMessage(event: MessageEvent) {
      const target = frame.current?.contentWindow;
      if (!target || event.source !== target) return;
      const data = event.data as BridgeRequest;
      if (!data || data.type !== "holdall:request" || typeof data.id !== "number" || typeof data.method !== "string") return;
      const reply = (payload: { result?: unknown; error?: string }) => target.postMessage({ type: "holdall:response", id: data.id, ...payload }, "*");
      if (data.method === "theme.tokens") {
        reply({ result: readTheme() });
        return;
      }
      if (data.method === "events.subscribe") {
        if (!events) {
          events = new EventSource(`/api/plugins/${encodeURIComponent(pluginId)}/events`);
          events.onmessage = (message) => {
            try {
              const { event, data: payload } = JSON.parse(message.data) as { event: string; data: unknown };
              target.postMessage({ type: "holdall:event", event, data: payload }, "*");
            } catch {
              return;
            }
          };
        }
        reply({ result: true });
        return;
      }
      const server = data.method === "server.call";
      try {
        const response = await fetch(`/api/plugins/${encodeURIComponent(pluginId)}/${server ? "call" : "rpc"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(server ? (data.params ?? {}) : { method: data.method, params: data.params ?? {} }),
        });
        const body = (await response.json()) as { result?: unknown; error?: string };
        reply(response.ok ? { result: body.result } : { error: body.error ?? "The call failed." });
      } catch {
        reply({ error: "Holdall could not be reached." });
      }
    }
    window.addEventListener("message", onMessage);
    let cancelled = false;
    void fetch(`/api/plugins/${encodeURIComponent(pluginId)}/token`)
      .then((response) => (response.ok ? (response.json() as Promise<{ token: string }>) : undefined))
      .then((body) => {
        if (cancelled || !body || !frame.current || frame.current.getAttribute("src")) return;
        const path = entry.split("/").map(encodeURIComponent).join("/");
        frame.current.setAttribute("src", `/api/plugins/${encodeURIComponent(pluginId)}/ui/${body.token}/${path}`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      events?.close();
    };
  }, [pluginId, entry]);

  return (
    <iframe
      ref={frame}
      className={styles.frame}
      data-tall={tall || undefined}
      title={title}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
      allow="fullscreen; clipboard-write; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="no-referrer"
    />
  );
}
