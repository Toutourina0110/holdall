import type { Metadata } from "next";
import Link from "next/link";
import { findOpenInvitation } from "@/core/auth/accounts";
import { strings } from "@/core/strings";
import { Notice } from "@/ui/controls";
import { AccountForm } from "../../AccountForm";
import { inviteAction } from "../../actions";
import { AuthPanel } from "../../AuthPanel";
import styles from "../../auth.module.css";

export const metadata: Metadata = { title: strings.auth.inviteTitle, referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = strings.auth;
  const invitation = findOpenInvitation(token);
  return (
    <AuthPanel crumb={t.inviteTitle} title={t.inviteTitle} intro={invitation ? t.inviteIntro : t.inviteInvalid}>
      {invitation ? (
        <AccountForm action={inviteAction} submitLabel={t.inviteSubmit} token={token} />
      ) : (
        <div className={styles.form}>
          <Notice tone="warn">{t.inviteInvalid}</Notice>
        </div>
      )}
      <p className={styles.foot}>
        <Link href="/login">{t.backToLogin}</Link>
      </p>
    </AuthPanel>
  );
}
