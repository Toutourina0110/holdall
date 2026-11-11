"use client";

import { useActionState } from "react";
import { strings } from "@/core/strings";
import { Button, Field, Notice } from "@/ui/controls";
import { resetPasswordAction } from "../../actions";
import styles from "../../auth.module.css";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {});
  const t = strings.auth;
  return (
    <form className={styles.form} action={formAction} noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="token" value={token} />
      <Field
        label={t.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t.passwordHint}
        required
        error={state.fieldErrors?.password}
      />
      <Button variant="primary" type="submit" disabled={pending}>
        {t.resetSubmit}
      </Button>
    </form>
  );
}
