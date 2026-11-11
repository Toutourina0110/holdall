import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { isDesktop } from "@/core/target";
import { Notice } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { PageHeader } from "@/ui/PageHeader";
import { oauthConfig } from "@/modules/calendar/providers";
import { listAccounts, listCalendars, listHistory } from "@/modules/calendar/store";
import { AccountActions, CaldavForm, CalendarToggle } from "./AccountsPanel";
import styles from "./accounts.module.css";

export const metadata: Metadata = { title: strings.calendarAccounts.title };

function errorText(code: string | undefined) {
  const t = strings.calendarAccounts;
  if (!code) return undefined;
  if (code === "denied") return t.errorDenied;
  return t.errorState;
}

export default async function CalendarAccountsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const t = strings.calendarAccounts;
  const accounts = listAccounts(session.user.id).filter((account) => account.provider !== "local");
  const calendars = listCalendars(session.user.id);
  const history = listHistory(session.user.id);
  const providers = [
    { id: "google" as const, label: t.connectGoogle, name: "Google Calendar" },
    { id: "microsoft" as const, label: t.connectMicrosoft, name: "Outlook" },
  ];

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/calendar">
        <Icon name="back" />
        {strings.calendar.title}
      </Link>
      <PageHeader title={t.title} intro={t.intro} />
      {params.connected && <Notice tone="success">{t.connected}</Notice>}
      {params.error && <Notice tone="error">{errorText(params.error)}</Notice>}

      {!isDesktop() && (
        <section className={styles.connect} aria-label={t.title}>
          {providers.map((provider) =>
            oauthConfig(provider.id) ? (
              <a key={provider.id} className={styles.provider} href={`/api/calendar/oauth/${provider.id}/start`}>
                <Icon name="link" />
                {provider.label}
              </a>
            ) : (
              <p key={provider.id} className={styles.unavailable}>
                {t.notConfigured.replace("{provider}", provider.name)}
              </p>
            ),
          )}
        </section>
      )}

      <section className={styles.panel}>
        <h2>{t.listTitle}</h2>
        {accounts.length === 0 && <p className={styles.empty}>{t.none}</p>}
        <ul className={styles.accounts}>
          {accounts.map((account) => (
            <li key={account.id} className={styles.account}>
              <div className={styles.accountHead}>
                <div>
                  <b>{account.name}</b>
                  <span className={styles.status} data-status={account.status}>
                    {t.status[account.status]}
                  </span>
                  <span className={styles.meta}>
                    {t.lastSync}: {account.lastSyncAt ? account.lastSyncAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : t.never}
                  </span>
                </div>
                <AccountActions id={account.id} />
              </div>
              {account.error && <Notice tone="error">{account.error}</Notice>}
              <ul className={styles.calendars} aria-label={t.calendars}>
                {calendars
                  .filter((item) => item.accountId === account.id)
                  .map((item) => (
                    <li key={item.id}>
                      <CalendarToggle id={item.id} name={item.name} color={item.color} shown={item.enabled} label={t.show} />
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2>{t.caldavTitle}</h2>
        <p className={styles.meta}>{t.caldavHelp}</p>
        <CaldavForm />
      </section>

      <section className={styles.panel}>
        <h2>{t.historyTitle}</h2>
        {history.length === 0 && <p className={styles.empty}>{t.historyEmpty}</p>}
        <ol className={styles.history}>
          {history.map((entry) => (
            <li key={entry.id}>
              <span className={styles.meta}>{entry.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
              <b>{entry.title}</b>
              <span>{entry.message}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
