import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { Panel, PanelRow } from "@/ui/Panel";
import { PasswordPanel, SessionsPanel } from "./AccountPanels";
import styles from "./settings.module.css";

export const metadata: Metadata = { title: strings.settings.tabAccount };

export default async function AccountSettingsPage() {
  const session = await requireSession();
  const t = strings.settings;
  return (
    <>
      <Panel title={t.profileTitle}>
        <PanelRow>
          <span className={styles.label}>{t.name}</span>
          <span className={styles.strong}>{session.user.name}</span>
        </PanelRow>
        <PanelRow>
          <span className={styles.label}>{strings.auth.email}</span>
          <span className={styles.strong}>{session.user.email}</span>
        </PanelRow>
        <PanelRow>
          <span className={styles.label}>{t.role}</span>
          <span className={styles.strong}>{session.user.role === "admin" ? strings.shell.roleAdmin : strings.shell.roleUser}</span>
        </PanelRow>
      </Panel>
      <PasswordPanel />
      <SessionsPanel currentToken={session.session.token} />
    </>
  );
}
