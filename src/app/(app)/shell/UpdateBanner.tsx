"use client";

import { useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button } from "@/ui/controls";
import { triggerUpdateAction } from "../actions";
import styles from "./shell.module.css";

export type UpdateInfo = { version: string; url: string; admin: boolean; webhook: boolean };

export function UpdateBanner({ update }: { update: UpdateInfo }) {
  const t = strings.update;
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string>();
  return (
    <div className={styles.updateBanner} role="status">
      <span>{t.available.replace("{version}", update.version)}</span>
      <a href={update.url} target="_blank" rel="noreferrer">
        {t.notes}
      </a>
      {update.admin && update.webhook && !message && (
        <Button
          icon="download"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await triggerUpdateAction();
              setMessage(result.error ?? t.started);
            })
          }
        >
          {pending ? t.starting : t.now}
        </Button>
      )}
      {update.admin && !update.webhook && (
        <span>
          {t.command} <code>docker compose pull &amp;&amp; docker compose up -d</code>
        </span>
      )}
      {message && <span>{message}</span>}
    </div>
  );
}
