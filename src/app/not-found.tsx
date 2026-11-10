import type { Metadata } from "next";
import Link from "next/link";
import { strings } from "@/core/strings";
import { PageFrame } from "@/ui/PageFrame";
import { SurveyMark } from "@/ui/SurveyMark";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: strings.notFound.title,
};

export default function NotFound() {
  const t = strings.notFound;
  return (
    <PageFrame crumb={t.crumb}>
      <section className={styles.panel}>
        <SurveyMark state="late" size={32} />
        <h1 className={styles.title}>{t.heading}</h1>
        <p className={styles.body}>{t.body}</p>
        <Link className={styles.back} href="/">
          {t.back}
        </Link>
      </section>
    </PageFrame>
  );
}
