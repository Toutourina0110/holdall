"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "@/core/auth/client";
import { strings } from "@/core/strings";
import { Button, Field, Notice } from "@/ui/controls";
import { Panel, PanelEmpty, PanelForm, PanelRow } from "@/ui/Panel";
import styles from "./settings.module.css";

type SessionRow = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; createdAt: Date | string };

function describeAgent(agent?: string | null) {
  if (!agent) return strings.settings.unknownDevice;
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const os = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export function PasswordPanel() {
  const t = strings.settings;
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string }>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword.length < 10) {
      setMessage({ tone: "error", text: strings.auth.passwordHint });
      return;
    }
    setPending(true);
    const result = await authClient.changePassword({
      currentPassword: String(data.get("currentPassword") ?? ""),
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (result.error) {
      setMessage({ tone: "error", text: result.error.status === 429 ? strings.auth.tooManyAttempts : t.passwordWrong });
      return;
    }
    form.reset();
    setMessage({ tone: "success", text: t.passwordChanged });
  }

  return (
    <Panel title={t.passwordTitle}>
      <form onSubmit={submit}>
        <PanelForm>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <Field label={t.currentPassword} name="currentPassword" type="password" autoComplete="current-password" required />
          <Field label={t.newPassword} name="newPassword" type="password" autoComplete="new-password" hint={strings.auth.passwordHint} required />
          <Button variant="primary" type="submit" disabled={pending}>
            {t.changePassword}
          </Button>
        </PanelForm>
      </form>
    </Panel>
  );
}

export function SessionsPanel({ currentToken }: { currentToken: string }) {
  const t = strings.settings;
  const [sessions, setSessions] = useState<SessionRow[]>();
  const [error, setError] = useState<string>();

  async function load() {
    const result = await authClient.listSessions();
    if (result.error) setError(t.sessionsError);
    else setSessions(result.data as SessionRow[]);
  }

  useEffect(() => {
    let active = true;
    authClient.listSessions().then((result) => {
      if (!active) return;
      if (result.error) setError(t.sessionsError);
      else setSessions(result.data as SessionRow[]);
    });
    return () => {
      active = false;
    };
  }, [t.sessionsError]);

  async function revoke(token: string) {
    await authClient.revokeSession({ token });
    await load();
  }

  async function revokeOthers() {
    await authClient.revokeOtherSessions();
    await load();
  }

  return (
    <Panel
      title={t.sessionsTitle}
      count={sessions ? `${sessions.length}` : undefined}
      tools={
        sessions && sessions.length > 1 ? (
          <Button onClick={revokeOthers} icon="logout">
            {t.signOutOthers}
          </Button>
        ) : undefined
      }
    >
      {error && <PanelEmpty>{error}</PanelEmpty>}
      {!sessions && !error && <PanelEmpty>{t.loading}</PanelEmpty>}
      {sessions?.map((session) => (
        <PanelRow key={session.id}>
          <span className={styles.grow}>
            <span className={styles.strong}>{describeAgent(session.userAgent)}</span>
            <span className={styles.meta}>
              {" "}
              {t.since} {new Date(session.createdAt).toLocaleString("en-GB")}
              {session.ipAddress ? `, ${session.ipAddress}` : ""}
            </span>
          </span>
          {session.token === currentToken ? (
            <span className={styles.current}>{t.thisDevice}</span>
          ) : (
            <Button variant="danger" onClick={() => revoke(session.token)}>
              {t.signOutDevice}
            </Button>
          )}
        </PanelRow>
      ))}
    </Panel>
  );
}
