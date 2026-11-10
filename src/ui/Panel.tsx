import type { ReactNode } from "react";
import styles from "./Panel.module.css";

export function Panel({ title, count, tools, children, id }: { title: string; count?: string; tools?: ReactNode; children: ReactNode; id?: string }) {
  const headingId = id ?? `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {count && <span className={styles.count}>{count}</span>}
        {tools && <div className={styles.tools}>{tools}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

export function PanelRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export function PanelForm({ children }: { children: ReactNode }) {
  return <div className={styles.form}>{children}</div>;
}
