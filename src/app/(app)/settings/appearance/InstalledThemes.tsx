"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Chip, Notice } from "@/ui/controls";
import { Panel, PanelForm, PanelRow } from "@/ui/Panel";
import { applyPluginThemeAction } from "./actions";
import styles from "./appearance.module.css";

export function InstalledThemes({ themes }: { themes: { id: string; name: string; base: string; source: string }[] }) {
  const t = strings.appearance;
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Panel title={t.installedThemes} count={`${themes.length}`}>
      {error && (
        <PanelForm>
          <Notice tone="error">{error}</Notice>
        </PanelForm>
      )}
      {themes.map((item) => (
        <PanelRow key={item.id}>
          <span className={styles.grow}>
            {item.name} <span className={styles.meta}>{item.base === "dark" ? t.dark : t.light}</span>
          </span>
          {item.source !== "official" && <Chip>{strings.plugins.thirdParty}</Chip>}
          <Button
            icon="palette"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await applyPluginThemeAction(item.id);
                if (result.error) setError(result.error);
                else router.refresh();
              })
            }
          >
            {t.useTheme}
          </Button>
        </PanelRow>
      ))}
    </Panel>
  );
}
