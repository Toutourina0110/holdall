"use client";

import { useActionState, useRef } from "react";
import { strings } from "@/core/strings";
import { Button, Notice } from "@/ui/controls";
import { importNotesAction } from "./actions";
import styles from "./notes.module.css";

export function ImportForm({ folder }: { folder: string }) {
  const t = strings.notes;
  const [state, action, pending] = useActionState(importNotesAction, {});
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <form ref={form} action={action} className={styles.import}>
      <input type="hidden" name="folder" value={folder} />
      <input
        ref={input}
        type="file"
        name="files"
        multiple
        accept=".md,.markdown,.txt,.zip"
        hidden
        onChange={() => form.current?.requestSubmit()}
      />
      <Button icon="upload" disabled={pending} onClick={() => input.current?.click()}>
        {t.import}
      </Button>
      {state.message && <Notice tone="success">{t.imported.replace("{count}", state.message)}</Notice>}
      {state.error && <Notice tone="error">{state.error === "none" ? t.importFailed : state.error}</Notice>}
    </form>
  );
}
