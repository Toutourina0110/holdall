import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { strings } from "@/core/strings";
import { Button, Notice } from "@/ui/controls";
import { AuthPanel } from "../AuthPanel";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: strings.demo.title };

const errors = strings.demo.errors;

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const env = getEnv();
  if (!env.demoMode) notFound();
  if (await getSession()) redirect("/");
  const { error } = await searchParams;
  const t = strings.demo;
  const message = error ? (errors[error as keyof typeof errors] ?? errors.failed) : undefined;
  return (
    <AuthPanel crumb={t.title} title={t.title} intro={t.intro.replace("{minutes}", String(env.demoResetMinutes))}>
      {message && <Notice tone="error">{message}</Notice>}
      <form method="post" action="/api/demo/start" className={styles.form}>
        <Button variant="primary" type="submit" icon="play">
          {t.start}
        </Button>
      </form>
      <p className={styles.foot}>{t.off}</p>
    </AuthPanel>
  );
}
