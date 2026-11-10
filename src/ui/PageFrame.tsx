import type { ReactNode } from "react";
import Link from "next/link";
import { strings } from "@/core/strings";
import { SurveyMark } from "./SurveyMark";
import styles from "./PageFrame.module.css";

export function PageFrame({
  crumb,
  aside,
  children,
}: {
  crumb: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/">
          <span className={styles.brandTile}>
            <SurveyMark state="done" size={16} />
          </span>
          {strings.app.name}
        </Link>
        <span className={styles.sep} aria-hidden="true">
          /
        </span>
        <span className={styles.crumb}>{crumb}</span>
        {aside && <div className={styles.aside}>{aside}</div>}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
