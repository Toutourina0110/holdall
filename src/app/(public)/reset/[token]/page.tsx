import type { Metadata } from "next";
import Link from "next/link";
import { findOpenPasswordReset } from "@/core/auth/accounts";
import { strings } from "@/core/strings";
import { Notice } from "@/ui/controls";
import { AuthPanel } from "../../AuthPanel";
import styles from "../../auth.module.css";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: strings.auth.resetTitle, referrer: "no-referrer" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = strings.auth;
  const reset = findOpenPasswordReset(token);
  return (
    <AuthPanel crumb={t.resetTitle} title={t.resetTitle} intro={reset ? t.resetIntro : t.resetInvalid}>
      {reset ? (
        <ResetForm token={token} />
      ) : (
        <div className={styles.form}>
          <Notice tone="warn">{t.resetInvalid}</Notice>
        </div>
      )}
      <p className={styles.foot}>
        <Link href="/login">{t.backToLogin}</Link>
      </p>
    </AuthPanel>
  );
}
