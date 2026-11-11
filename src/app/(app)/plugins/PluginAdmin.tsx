"use client";

import { useActionState, useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Chip, Field, Notice } from "@/ui/controls";
import { Panel, PanelEmpty, PanelForm, PanelRow } from "@/ui/Panel";
import { stageFromStoreAction, stageUploadAction, togglePermissionAction, uninstallAction, type StageState } from "./actions";
import styles from "../admin/admin.module.css";

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

export type StoreRow = {
  id: string;
  name: string;
  version: string;
  type: keyof typeof strings.plugins.types;
  author: string;
  description: string;
  source: "official" | "third-party";
  state: "new" | "update" | "installed";
};

export function StorePanel({ entries, error, loading }: { entries: StoreRow[]; error?: string; loading?: boolean }) {
  const t = strings.plugins;
  const [problem, setProblem] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Panel title={t.storeTitle} count={error || loading ? undefined : `${entries.length}`}>
      <PanelForm>
        <p className={styles.help}>{t.storeIntro}</p>
        {error && <Notice tone="error">{error}</Notice>}
        {problem && <Notice tone="error">{problem}</Notice>}
      </PanelForm>
      {loading && <PanelEmpty>{strings.settings.loading}</PanelEmpty>}
      {!error && !loading && entries.length === 0 && <PanelEmpty>{t.storeEmpty}</PanelEmpty>}
      {entries.map((entry) => (
        <PanelRow key={entry.id}>
          <span className={styles.grow}>
            <span className={styles.strong}>{entry.name}</span>
            <span className={styles.meta}>
              {" "}
              {entry.version} · {t.types[entry.type]} · {entry.author}
            </span>
            {entry.description && <span className={styles.block}>{entry.description}</span>}
          </span>
          <Chip>{entry.source === "official" ? t.official : t.thirdParty}</Chip>
          {entry.state === "installed" ? (
            <span className={styles.meta}>{t.installedLabel}</span>
          ) : (
            <Button
              variant={entry.state === "update" ? "primary" : "quiet"}
              icon="download"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await stageFromStoreAction(entry.id);
                  if (result?.error) setProblem(result.error);
                })
              }
            >
              {entry.state === "update" ? t.updateTo.replace("{version}", entry.version) : t.get}
            </Button>
          )}
        </PanelRow>
      ))}
    </Panel>
  );
}
