"use client";

import { strings } from "@/core/strings";
import { Icon } from "@/ui/Icon";
import { PluginFrame } from "@/ui/PluginFrame";
import { useCustomize } from "./shell/CustomizeContext";
import { SlotList } from "./shell/SlotList";
import styles from "./today.module.css";

export function WidgetGrid() {
  const customize = useCustomize();
  const t = strings.today;
  const widgets = customize.slot("dashboard.widgets");
  if (widgets.length === 0) {
    return (
      <section className={styles.empty} aria-labelledby="widgets-empty">
        <Icon name="layout" size={20} />
        <div>
          <h2 id="widgets-empty">{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
        </div>
      </section>
    );
  }
  return (
    <SlotList
      slot="dashboard.widgets"
      className={styles.grid}
      render={(item) => (
        <article className={styles.widget} data-width={item.style.width ?? item.widget?.width ?? 1}>
          <header className={styles.widgetHead}>
            <h2>{item.style.label || item.widget?.title || item.label}</h2>
          </header>
          {item.widget && <PluginFrame pluginId={item.widget.pluginId} entry={item.widget.entry} title={item.widget.title} />}
        </article>
      )}
    />
  );
}
