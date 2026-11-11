"use client";

import { useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Chip, IconButton } from "@/ui/controls";
import { Panel, PanelEmpty, PanelForm, PanelRow } from "@/ui/Panel";
import { clearNotificationsAction, deleteNotificationAction, markAllReadAction } from "./actions";
import styles from "../admin/admin.module.css";

export type NotificationItem = { id: string; source: string; title: string; body: string; read: boolean; createdAt: string };

function when(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const t = strings.notifications;
  const [pending, start] = useTransition();
  const unread = items.filter((item) => !item.read).length;
  return (
    <Panel title={t.title} count={`${unread} ${t.unread}`}>
      {items.length > 0 && (
        <PanelForm>
          <div className={styles.actions}>
            <Button icon="check" disabled={pending || unread === 0} onClick={() => start(() => markAllReadAction())}>
              {t.markAllRead}
            </Button>
            <Button
              variant="danger"
              icon="trash"
              disabled={pending}
              onClick={() => {
                if (confirm(t.clearConfirm)) start(() => clearNotificationsAction());
              }}
            >
              {t.clearAll}
            </Button>
          </div>
        </PanelForm>
      )}
      {items.length === 0 && <PanelEmpty>{t.empty}</PanelEmpty>}
      {items.map((item) => (
        <PanelRow key={item.id}>
          <span className={styles.grow}>
            {!item.read && <Chip>{t.newLabel}</Chip>} <span className={styles.strong}>{item.title}</span>
            <span className={styles.meta}>
              {" "}
              {item.source}, {when(item.createdAt)}
            </span>
            {item.body && <span className={`${styles.meta} ${styles.block}`}>{item.body}</span>}
          </span>
          <IconButton icon="trash" label={`${t.remove}: ${item.title}`} disabled={pending} onClick={() => start(() => deleteNotificationAction(item.id))} />
        </PanelRow>
      ))}
    </Panel>
  );
}
