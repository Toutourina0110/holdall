import type { Metadata } from "next";
import Link from "next/link";
import { isRegistrationOpen } from "@/core/auth/accounts";
import { strings } from "@/core/strings";
import { Notice } from "@/ui/controls";
import { AccountForm } from "../AccountForm";
import { registerAction } from "../actions";
import { AuthPanel } from "../AuthPanel";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: strings.auth.registerTitle };

export default function RegisterPage() {
  const t = strings.auth;
  const open = isRegistrationOpen();
  return (
    <AuthPanel crumb={t.registerTitle} title={t.registerTitle} intro={open ? t.registerIntro : t.registerClosed}>
      {open ? (
        <AccountForm action={registerAction} submitLabel={t.registerSubmit} />
      ) : (
        <div className={styles.form}>
          <Notice>{t.registerClosed}</Notice>
        </div>
      )}
      <p className={styles.foot}>
        <Link href="/login">{t.backToLogin}</Link>
      </p>
    </AuthPanel>
  );
}
