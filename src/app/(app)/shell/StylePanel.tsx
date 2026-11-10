"use client";

import type { ElementStyle } from "@/core/layout/schema";
import { strings } from "@/core/strings";
import { Button, Field, IconButton, Segmented } from "@/ui/controls";
import { Icon, type IconName } from "@/ui/Icon";
import { useCustomize } from "./CustomizeContext";
import styles from "./shell.module.css";

const iconChoices: IconName[] = ["today", "notes", "tasks", "calendar", "downloads", "converter", "files", "plugins", "settings", "admin", "link", "user", "palette", "layout"];

export function StylePanel() {
  const customize = useCustomize();
  const t = strings.shell;
  if (!customize.customizing || !customize.selectedId) return null;
  const id = customize.selectedId;
  const item = customize.item(id);
  if (!item) return null;
  const style = customize.style(id);
  const set = (change: Partial<ElementStyle>) => customize.setStyle(id, { ...style, ...change });

  return (
    <aside className={styles.stylePanel} aria-label={t.styleTitle}>
      <header className={styles.stylePanelHead}>
        <h2>
          {t.styleTitle}: {style.label || item.label}
        </h2>
        <IconButton icon="x" label={t.close} onClick={() => customize.select(undefined)} />
      </header>
      <div className={styles.stylePanelBody}>
        <Field label={t.label} name="label" value={style.label ?? ""} placeholder={item.label} maxLength={40} onChange={(event) => set({ label: event.target.value || undefined })} />
        <div className={styles.styleRow}>
          <span className={styles.styleLabel}>{t.icon}</span>
          <div className={styles.iconGrid} role="radiogroup" aria-label={t.icon}>
            {iconChoices.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={(style.icon ?? item.icon) === name}
                aria-label={name}
                className={styles.iconChoice}
                onClick={() => set({ icon: name })}
              >
                <Icon name={name} />
              </button>
            ))}
          </div>
        </div>
        <div className={styles.styleRow}>
          <label className={styles.styleLabel} htmlFor="style-color">
            {t.color}
          </label>
          <input id="style-color" type="color" className={styles.colorInput} value={style.color ?? "#1f4a7a"} onChange={(event) => set({ color: event.target.value })} />
          <label className={styles.styleLabel} htmlFor="style-background">
            {t.background}
          </label>
          <input id="style-background" type="color" className={styles.colorInput} value={style.background ?? "#1e2c38"} onChange={(event) => set({ background: event.target.value })} />
        </div>
        <div className={styles.styleRow}>
          <span className={styles.styleLabel}>{t.size}</span>
          <Segmented label={t.size} value={style.size ?? "md"} onChange={(size) => set({ size })} options={[{ value: "sm", label: t.small }, { value: "md", label: t.medium }, { value: "lg", label: t.large }]} />
        </div>
        <div className={styles.styleRow}>
          <span className={styles.styleLabel}>{t.spacing}</span>
          <Segmented label={t.spacing} value={style.spacing ?? "normal"} onChange={(spacing) => set({ spacing })} options={[{ value: "tight", label: t.tight }, { value: "normal", label: t.normal }, { value: "loose", label: t.loose }]} />
        </div>
        <div className={styles.styleRow}>
          <span className={styles.styleLabel}>{t.radius}</span>
          <Segmented label={t.radius} value={style.radius ?? "md"} onChange={(radius) => set({ radius })} options={[{ value: "none", label: t.none }, { value: "sm", label: t.small }, { value: "md", label: t.medium }, { value: "lg", label: t.large }]} />
        </div>
      </div>
      <footer className={styles.stylePanelFoot}>
        <Button icon="reset" onClick={() => customize.resetElement(id)}>
          {t.resetElement}
        </Button>
      </footer>
    </aside>
  );
}
