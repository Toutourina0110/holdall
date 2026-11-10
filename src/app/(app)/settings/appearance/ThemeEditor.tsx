"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { contrastPairs, contrastRatio } from "@/core/theme/contrast";
import { colorTokens, lengthTokens, type Theme, type ThemeMode } from "@/core/theme/schema";
import { strings } from "@/core/strings";
import { Button, Field, Notice, Segmented } from "@/ui/controls";
import { Panel, PanelForm, PanelRow } from "@/ui/Panel";
import { saveThemeAction } from "./actions";
import styles from "./appearance.module.css";

const tokenGroups = [
  { title: strings.appearance.groupColors, tokens: colorTokens },
  { title: strings.appearance.groupCorners, tokens: lengthTokens.filter((token) => token.startsWith("--radius")) },
  { title: strings.appearance.groupSpacing, tokens: lengthTokens.filter((token) => token.startsWith("--space")) },
  { title: strings.appearance.groupText, tokens: lengthTokens.filter((token) => token.startsWith("--text")) },
  { title: strings.appearance.groupDensity, tokens: lengthTokens.filter((token) => token.startsWith("--size")) },
];

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${value.slice(1).split("").map((d) => d + d).join("")}`;
  const rgb = value.match(/(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (!rgb) return "#000000";
  return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}

export function ThemeEditor({ mode: savedMode, theme: savedTheme }: { mode: ThemeMode; theme?: Theme }) {
  const t = strings.appearance;
  const [mode, setMode] = useState<ThemeMode>(savedMode);
  const [base, setBase] = useState<"light" | "dark">(savedTheme?.base ?? "light");
  const [name, setName] = useState(savedTheme?.name ?? t.defaultName);
  const [tokens, setTokens] = useState<Record<string, string>>(savedTheme?.tokens ?? {});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string }>();
  const [saving, startSaving] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    if (mode === "light" || mode === "dark") root.dataset.theme = mode;
    else if (mode === "custom") root.dataset.theme = base;
    else delete root.dataset.theme;
    const applied: string[] = [];
    if (mode === "custom") {
      for (const [token, value] of Object.entries(tokens)) {
        root.style.setProperty(token, value);
        applied.push(token);
      }
    }
    const values: Record<string, string> = {};
    for (const token of [...colorTokens, ...lengthTokens]) values[token] = readToken(token);
    const frame = requestAnimationFrame(() => setDefaults(values));
    return () => {
      cancelAnimationFrame(frame);
      for (const token of applied) root.style.removeProperty(token);
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
    };
  }, [mode, base, tokens]);

  const contrast = useMemo(
    () =>
      contrastPairs.map((pair) => ({
        ...pair,
        ratio: contrastRatio(tokens[pair.foreground] ?? defaults[pair.foreground] ?? "", tokens[pair.background] ?? defaults[pair.background] ?? ""),
      })),
    [tokens, defaults],
  );
  const failing = contrast.filter((pair) => pair.ratio !== undefined && pair.ratio < 4.5);

  function setToken(token: string, value: string) {
    setTokens((current) => ({ ...current, [token]: value }));
  }

  function save() {
    setMessage(undefined);
    const theme: Theme = { name, base, tokens, css: undefined };
    startSaving(async () => {
      const result = await saveThemeAction(mode, mode === "custom" ? theme : undefined);
      setMessage(result.error ? { tone: "error", text: result.error } : { tone: "success", text: t.saved });
    });
  }

  function exportTheme() {
    const blob = new Blob([JSON.stringify({ name, base, tokens }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "theme"}.holdall-theme.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importTheme(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Partial<Theme>;
      if (data.base !== "light" && data.base !== "dark") throw new Error();
      setMode("custom");
      setBase(data.base);
      setName(String(data.name ?? t.defaultName));
      setTokens(data.tokens && typeof data.tokens === "object" ? (data.tokens as Record<string, string>) : {});
      setMessage({ tone: "success", text: t.imported });
    } catch {
      setMessage({ tone: "error", text: t.importFailed });
    }
  }

  return (
    <>
      <Panel title={t.modeTitle}>
        <PanelForm>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <Segmented
            label={t.modeTitle}
            value={mode}
            onChange={setMode}
            options={[
              { value: "system", label: t.system },
              { value: "light", label: t.light },
              { value: "dark", label: t.dark },
              { value: "custom", label: t.custom },
            ]}
          />
          <p className={styles.help}>{t.modeHelp}</p>
          <div className={styles.actions}>
            <Button variant="primary" icon="check" onClick={save} disabled={saving}>
              {t.save}
            </Button>
            <Button icon="download" onClick={exportTheme} disabled={mode !== "custom"}>
              {t.export}
            </Button>
            <Button icon="upload" onClick={() => fileInput.current?.click()}>
              {t.import}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importTheme(file);
                event.target.value = "";
              }}
            />
          </div>
        </PanelForm>
      </Panel>

      {mode === "custom" && (
        <>
          <Panel title={t.contrastTitle} count={failing.length ? `${failing.length} ${t.contrastFailing}` : t.contrastOk}>
            {contrast.map((pair) => (
              <PanelRow key={pair.label}>
                <span className={styles.grow}>{pair.label}</span>
                <span className={styles.ratio} data-fail={pair.ratio !== undefined && pair.ratio < 4.5 ? true : undefined}>
                  {pair.ratio ? `${pair.ratio.toFixed(1)}:1` : "?"}
                </span>
              </PanelRow>
            ))}
          </Panel>
          <Panel title={t.editorTitle}>
            <PanelForm>
              <Field label={t.themeName} name="themeName" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
              <Segmented label={t.base} value={base} onChange={setBase} options={[{ value: "light", label: t.light }, { value: "dark", label: t.dark }]} />
            </PanelForm>
            {tokenGroups.map((group) => (
              <div key={group.title} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.title}</h3>
                <div className={styles.tokens}>
                  {group.tokens.map((token) => {
                    const value = tokens[token] ?? defaults[token] ?? "";
                    const isColor = colorTokens.includes(token);
                    return (
                      <label key={token} className={styles.token}>
                        <span className={styles.tokenName}>{token.replace(/^--(color-)?/, "")}</span>
                        {isColor && <input type="color" className={styles.swatch} value={toHex(value)} onChange={(event) => setToken(token, event.target.value)} />}
                        <input className={styles.tokenInput} value={value} onChange={(event) => setToken(token, event.target.value)} aria-label={token} />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </Panel>
        </>
      )}
    </>
  );
}
