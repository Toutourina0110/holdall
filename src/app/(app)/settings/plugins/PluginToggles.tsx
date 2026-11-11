"use client";

import { useTransition } from "react";
import { strings } from "@/core/strings";
import { Chip, Segmented } from "@/ui/controls";
import { Panel, PanelEmpty, PanelRow } from "@/ui/Panel";
import { setPluginEnabledAction } from "./actions";
import styles from "../settings.module.css";

export type UserPluginRow = {
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  source: string;
  enabled: boolean;
  permissions: string[];
};

export function PluginToggles({ plugins, isAdmin }: { plugins: UserPluginRow[]; isAdmin: boolean }) {
  const t = strings.plugins;
  const [pending, start] = useTransition();
  return (
    <Panel title={t.yourPlugins} count={`${plugins.length}`}>
      {plugins.length === 0 && <PanelEmpty>{isAdmin ? t.noneForAdmin : t.noneForUser}</PanelEmpty>}
      {plugins.map((item) => (
        <PanelRow key={item.id}>
          <span className={styles.grow}>
            <span className={styles.strong}>{item.name}</span>
            <span className={styles.meta}>
              {" "}
              {item.version}, {item.author}
            </span>
            {item.description && <span className={`${styles.meta} ${styles.block}`}>{item.description}</span>}
            {item.permissions.length > 0 && <span className={`${styles.meta} ${styles.block}`}>{item.permissions.join(", ")}</span>}
          </span>
          {item.source === "third-party" && <Chip icon="alert">{t.thirdParty}</Chip>}
          <Segmented
            label={`${t.useFor} ${item.name}`}
            value={item.enabled ? "on" : "off"}
            onChange={(value) => start(() => setPluginEnabledAction(item.id, value === "on"))}
            options={[
              { value: "off", label: t.off },
              { value: "on", label: t.on },
            ]}
          />
          {pending && <span className={styles.meta}>{strings.admin.saving}</span>}
        </PanelRow>
      ))}
    </Panel>
  );
}
