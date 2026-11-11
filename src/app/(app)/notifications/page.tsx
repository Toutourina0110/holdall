import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { listNotifications } from "@/core/notifications/store";
import { strings } from "@/core/strings";
import { PageHeader } from "@/ui/PageHeader";
import { NotificationList } from "./NotificationList";
import styles from "../admin/admin.module.css";

export const metadata: Metadata = { title: strings.notifications.title };

export default async function NotificationsPage() {
  const session = await requireSession();
  const items = listNotifications(session.user.id).map((row) => ({
    id: row.id,
    source: row.source,
    title: row.title,
    body: row.body,
    read: Boolean(row.readAt),
    createdAt: row.createdAt.toISOString(),
  }));
  return (
    <div className={styles.page}>
      <PageHeader title={strings.notifications.title} intro={strings.notifications.intro} />
      <NotificationList items={items} />
    </div>
  );
}
