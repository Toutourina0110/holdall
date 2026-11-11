"use client";

import { useActionState, useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Chip, Field, Notice } from "@/ui/controls";
import { Panel, PanelEmpty, PanelForm, PanelRow } from "@/ui/Panel";
import { stageUploadAction, togglePermissionAction, uninstallAction, type StageState } from "./actions";
import styles from "../admin.module.css";

export type AdminPluginRow = {
  id: string;
  name: string;
  version: string;
  author: string;
  source: string;
  description?: string;
  required: { permission: string; label: string }[];
  optional: { permission: string; label: string; granted: boolean }[];
};

export function InstallPanel() {
  const t = strings.plugins;
  const [state, action, pending] = useActionState<StageState, FormData>(stageUploadAction, {});
  return (
    <Panel title={t.installTitle}>
      <form action={action}>
        <PanelForm>
          <p className={styles.help}>{t.installHelp}</p>
          {state.error && <Notice tone="error">{state.error}</Notice>}
          <Field label={t.archive} name="archive" type="file" accept=".zip,application/zip" />
          <Field label={t.url} name="url" type="url" placeholder="https://" />
          <Field label={t.checksum} name="sha256" hint={t.checksumHint} maxLength={64} />
          <Button variant="primary" type="submit" icon="upload" disabled={pending}>
            {t.review}
          </Button>
        </PanelForm>
      </form>
    </Panel>
  );
}

export function InstalledPanel({ plugins }: { plugins: AdminPluginRow[] }) {
  const t = strings.plugins;
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Panel title={t.installedTitle} count={`${plugins.length}`}>
      {error && (
        <PanelForm>
          <Notice tone="error">{error}</Notice>
        </PanelForm>
      )}
      {plugins.length === 0 && <PanelEmpty>{t.noneInstalled}</PanelEmpty>}
      {plugins.map((item) => (
        <div key={item.id}>
          <PanelRow>
            <span className={styles.grow}>
              <span className={styles.strong}>{item.name}</span>
              <span className={styles.meta}>
                {" "}
                {item.version}, {item.author}
              </span>
            </span>
            {item.source === "third-party" && <Chip icon="alert">{t.thirdParty}</Chip>}
            <Button
              variant="danger"
              icon="trash"
              disabled={pending}
              onClick={() => {
                if (window.confirm(t.uninstallConfirm.replace("{name}", item.name))) start(() => uninstallAction(item.id));
              }}
            >
              {t.uninstall}
            </Button>
          </PanelRow>
          {item.optional.map((permission) => (
            <PanelRow key={permission.permission}>
              <label className={styles.grow}>
                <input
                  type="checkbox"
                  defaultChecked={permission.granted}
                  disabled={pending}
                  onChange={(event) =>
                    start(async () => {
                      const result = await togglePermissionAction(item.id, permission.permission, event.target.checked);
                      setError(result.error);
                    })
                  }
                />{" "}
                {permission.label}
              </label>
              <span className={styles.meta}>{t.optional}</span>
            </PanelRow>
          ))}
        </div>
      ))}
    </Panel>
  );
}
