"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { strings } from "@/core/strings";
import { Button, Field, Notice, Segmented } from "@/ui/controls";
import { addCaldavAction, removeAccountAction, setCalendarShownAction, syncAccountAction } from "../actions";
import styles from "./accounts.module.css";

export function AccountActions({ id }: { id: string }) {
  const t = strings.calendarAccounts;
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run(action: () => Promise<object | { error: string }>) {
    start(async () => {
      const result = await action();
      if ("error" in result) setError(String(result.error));
      else router.refresh();
    });
  }

  return (
    <div className={styles.actions}>
      <Button icon="sync" disabled={pending} onClick={() => run(() => syncAccountAction(id))}>
        {t.syncNow}
      </Button>
      <Button
        variant="danger"
        icon="trash"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t.removeConfirm)) run(() => removeAccountAction(id));
        }}
      >
        {t.remove}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function CalendarToggle({ id, name, color, shown, label }: { id: string; name: string; color: string; shown: boolean; label: string }) {
  const router = useRouter();
  const [value, setValue] = useState(shown);
  const [pending, start] = useTransition();
  return (
    <label className={styles.toggle} style={{ "--event-color": color } as CSSProperties}>
      <input
        type="checkbox"
        checked={value}
        disabled={pending}
        aria-label={`${label}: ${name}`}
        onChange={(event) => {
          const next = event.target.checked;
          setValue(next);
          start(async () => {
            const result = await setCalendarShownAction(id, next);
            if ("error" in result) setValue(!next);
            else router.refresh();
          });
        }}
      />
      <span className={styles.swatch} />
      {name}
    </label>
  );
}

export function CaldavForm() {
  const t = strings.calendarAccounts;
  const router = useRouter();
  const [kind, setKind] = useState<"icloud" | "caldav">("icloud");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    start(async () => {
      const result = await addCaldavAction({
        kind,
        serverUrl: kind === "caldav" ? String(form.get("serverUrl") ?? "") : undefined,
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      if ("error" in result) setError(result.error);
      else {
        setError(undefined);
        target.reset();
        router.push("/calendar/accounts?connected=1");
        router.refresh();
      }
    });
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Segmented
        label={t.kind}
        value={kind}
        onChange={setKind}
        options={[
          { value: "icloud", label: t.icloud },
          { value: "caldav", label: t.caldav },
        ]}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {kind === "caldav" && <Field label={t.serverUrl} name="serverUrl" type="url" required placeholder="https://" autoComplete="url" />}
      <Field label={t.username} name="username" required autoComplete="username" />
      <Field label={t.password} name="password" type="password" required autoComplete="current-password" />
      <div>
        <Button variant="primary" type="submit" icon="plus" disabled={pending}>
          {t.add}
        </Button>
      </div>
    </form>
  );
}

export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  return null;
}
