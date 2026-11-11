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
  const url = `/api/plugins/${encodeURIComponent(pluginId)}/ui/${entry.split("/").map(encodeURIComponent).join("/")}`;

  useEffect(() => {
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
      try {
        const response = await fetch(`/api/plugins/${encodeURIComponent(pluginId)}/rpc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: data.method, params: data.params ?? {} }),
        });
        const body = (await response.json()) as { result?: unknown; error?: string };
        reply(response.ok ? { result: body.result } : { error: body.error ?? "The call failed." });
      } catch {
        reply({ error: "Holdall could not be reached." });
      }
    }
    window.addEventListener("message", onMessage);
    if (frame.current && !frame.current.getAttribute("src")) frame.current.setAttribute("src", url);
    return () => window.removeEventListener("message", onMessage);
  }, [pluginId, url]);

  return (
    <iframe
      ref={frame}
      className={styles.frame}
      data-tall={tall || undefined}
      title={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
    />
  );
}
