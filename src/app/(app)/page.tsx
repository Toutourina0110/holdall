import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import styles from "./today.module.css";
import { WidgetGrid } from "./WidgetGrid";

export const metadata: Metadata = { title: strings.today.title };

function longDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export default async function TodayPage() {
  const session = await requireSession();
  const t = strings.today;
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{longDate(new Date())}</h1>
        <p className={styles.sub}>
          {t.greeting} {session.user.name}.
        </p>
      </header>
      <WidgetGrid />
    </div>
  );
}
