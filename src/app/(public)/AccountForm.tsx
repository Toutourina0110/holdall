"use client";

import { useActionState } from "react";
import { strings } from "@/core/strings";
import { Button, Field, Notice } from "@/ui/controls";
import type { FormState } from "./form-state";
import styles from "./auth.module.css";

export function AccountForm({
  action,
  submitLabel,
  token,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  token?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = strings.auth;
  return (
    <form className={styles.form} action={formAction} noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {token && <input type="hidden" name="token" value={token} />}
      <Field label={t.name} name="name" autoComplete="name" required error={state.fieldErrors?.name} />
      <Field label={t.email} name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <Field
        label={t.password}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t.passwordHint}
        required
        error={state.fieldErrors?.password}
      />
      <Button variant="primary" type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
