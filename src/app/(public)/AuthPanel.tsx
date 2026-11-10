import type { ReactNode } from "react";
import { PageFrame } from "@/ui/PageFrame";
import { SurveyMark } from "@/ui/SurveyMark";
import styles from "./auth.module.css";

export function AuthPanel({ crumb, title, intro, children }: { crumb: string; title: string; intro: string; children: ReactNode }) {
  return (
    <PageFrame crumb={crumb}>
      <section className={styles.panel} aria-labelledby="auth-title">
        <header className={styles.head}>
          <SurveyMark state="current" size={28} />
          <div>
            <h1 id="auth-title" className={styles.title}>
              {title}
            </h1>
            <p className={styles.intro}>{intro}</p>
          </div>
        </header>
        {children}
      </section>
    </PageFrame>
  );
}
