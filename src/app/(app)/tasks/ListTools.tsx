"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { Button, Notice } from "@/ui/controls";
import { createListAction, deleteListAction } from "./actions";
import styles from "./tasks.module.css";

export function NewListForm() {
  const t = strings.tasks;
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className={styles.newList}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await createListAction(name);
          if ("error" in result) setError(result.error);
          else {
            setName("");
            router.push(`/tasks?list=${result.id}`);
          }
        });
      }}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.inline}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.listName} aria-label={t.listName} maxLength={60} />
        <Button type="submit" icon="plus" disabled={pending || !name.trim()}>
          {t.newList}
        </Button>
      </div>
    </form>
  );
}

export function DeleteListButton({ id }: { id: string }) {
  const t = strings.tasks;
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      icon="trash"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t.deleteListConfirm)) return;
        start(async () => {
          await deleteListAction(id);
          router.push("/tasks?view=inbox");
        });
      }}
    >
      {t.deleteList}
    </Button>
  );
}
