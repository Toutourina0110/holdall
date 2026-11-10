"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/core/auth/client";
import { strings } from "@/core/strings";
import { Button, Field, Notice } from "@/ui/controls";
import styles from "../auth.module.css";

function safeNext(value: string | null): string {
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return "/";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

export function LoginForm({ next }: { next: string | null }) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const t = strings.auth;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const result = await authClient.signIn.email({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError(result.error.status === 429 ? t.tooManyAttempts : result.error.status === 401 ? t.wrongCredentials : t.genericError);
      return;
    }
    window.location.assign(safeNext(next));
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label={t.email} name="email" type="email" autoComplete="email" required />
      <Field label={t.password} name="password" type="password" autoComplete="current-password" required />
      <Button variant="primary" type="submit" disabled={pending}>
        {pending ? t.signingIn : t.signIn}
      </Button>
    </form>
  );
}
