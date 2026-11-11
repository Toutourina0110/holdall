import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { countUsers, isRegistrationOpen } from "@/core/auth/accounts";
import { getSession } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { strings } from "@/core/strings";
import { AuthPanel } from "../AuthPanel";
import styles from "../auth.module.css";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: strings.auth.loginTitle };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (getEnv().demoMode && !(await getSession())) redirect("/demo");
  if (countUsers() === 0) redirect("/setup");
  if (await getSession()) redirect("/");
  const { next } = await searchParams;
  const t = strings.auth;
  return (
    <AuthPanel crumb={t.loginTitle} title={t.loginTitle} intro={t.loginIntro}>
      <LoginForm next={next ?? null} />
      <p className={styles.foot}>
        {isRegistrationOpen() ? <Link href="/register">{t.registerLink}</Link> : t.noAccount}
      </p>
    </AuthPanel>
  );
}
