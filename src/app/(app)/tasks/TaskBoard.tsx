"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import type { Task, TaskView } from "@/modules/tasks/store";
import { strings } from "@/core/strings";
import { Button, Field, IconButton, Notice, Segmented } from "@/ui/controls";
import { localDay, shortDay } from "@/ui/dates";
import { SurveyMark } from "@/ui/SurveyMark";
import { createTaskAction, deleteTaskAction, loadTasksAction, setDoneAction, updateTaskAction } from "./actions";
import styles from "./tasks.module.css";

type ListOption = { id: string; name: string };

function dueState(task: Task, today: string): "late" | "today" | undefined {
  if (!task.dueDate || task.completedAt) return undefined;
  if (task.dueDate < today) return "late";
  if (task.dueDate === today) return "today";
  return undefined;
}

function TaskEditor({ task, lists, onClose, onSaved }: { task: Task; lists: ListOption[]; onClose: () => void; onSaved: () => void }) {
  const t = strings.tasks;
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [priority, setPriority] = useState(String(task.priority));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const result = await updateTaskAction(task.id, {
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        dueDate: String(data.get("dueDate") ?? "") || null,
        dueTime: String(data.get("dueTime") ?? "") || null,
        priority: Number(priority),
        labels: String(data.get("labels") ?? "")
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean),
        listId: String(data.get("listId") ?? "") || null,
      });
      if ("error" in result) setError(result.error);
      else {
        onSaved();
        onClose();
      }
    });
  }

  return (
    <form className={styles.editor} onSubmit={submit} aria-label={t.edit}>
      <header className={styles.editorHead}>
        <h2>{t.edit}</h2>
        <IconButton icon="x" label={t.close} onClick={onClose} />
      </header>
      <div className={styles.editorBody}>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label={t.titleLabel} name="title" defaultValue={task.title} required maxLength={300} />
        <Field label={t.description} name="description" defaultValue={task.description} multiline maxLength={20000} />
        <div className={styles.row2}>
          <Field label={t.dueDate} name="dueDate" type="date" defaultValue={task.dueDate ?? ""} />
          <Field label={t.dueTime} name="dueTime" type="time" defaultValue={task.dueTime ?? ""} />
        </div>
        <div className={styles.fieldLike}>
          <span>{t.priority}</span>
          <Segmented
            label={t.priority}
            value={priority}
            onChange={setPriority}
            options={[
              { value: "0", label: t.priorityNone },
              { value: "1", label: t.priorityLow },
              { value: "2", label: t.priorityMedium },
              { value: "3", label: t.priorityHigh },
            ]}
          />
        </div>
        <Field label={t.labels} name="labels" defaultValue={task.labels.join(", ")} hint={t.labelsHint} />
        <label className={styles.fieldLike}>
          <span>{t.list}</span>
          <select name="listId" defaultValue={task.listId ?? ""} className={styles.select}>
            <option value="">{t.noList}</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </label>
        {task.noteId && (
          <Link href={`/notes?id=${task.noteId}`} className={styles.meta}>
            {t.fromNote}
          </Link>
        )}
      </div>
      <footer className={styles.editorFoot}>
        <Button variant="primary" type="submit" icon="check" disabled={pending}>
          {t.save}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t.deleteConfirm)) return;
            start(async () => {
              const result = await deleteTaskAction(task.id);
              if ("error" in result) setError(result.error);
              else {
                onSaved();
                onClose();
              }
            });
          }}
        >
          {t.delete}
        </Button>
      </footer>
    </form>
  );
}

function TaskRow({
  task,
  today,
  subtasks: childTasks,
  onToggle,
  onOpen,
  selected,
}: {
  task: Task;
  today: string;
  subtasks?: Task[];
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  selected: boolean;
}) {
  const t = strings.tasks;
  const state = dueState(task, today);
  const mark = task.completedAt ? "done" : state === "late" ? "late" : "open";
  return (
    <li className={styles.task} data-selected={selected || undefined}>
      <div className={styles.taskLine}>
        <button type="button" className={styles.check} aria-label={task.completedAt ? t.reopen : t.complete} aria-pressed={Boolean(task.completedAt)} onClick={() => onToggle(task)}>
          <SurveyMark state={mark} />
        </button>
        <button type="button" className={styles.taskBody} onClick={() => onOpen(task)}>
          <span className={styles.taskTitle} data-done={task.completedAt ? true : undefined}>
            {task.title}
          </span>
          <span className={styles.taskMeta}>
            {task.priority > 0 && <span data-priority={task.priority}>{[t.priorityNone, t.priorityLow, t.priorityMedium, t.priorityHigh][task.priority]}</span>}
            {task.labels.map((label) => (
              <span key={label}>#{label}</span>
            ))}
            {task.noteId && <span>{t.fromNote}</span>}
          </span>
        </button>
        {task.dueDate && (
          <span className={styles.due} data-state={state}>
            {state === "late" ? `${t.overdue}, ${shortDay(task.dueDate)}` : state === "today" ? t.dueToday : shortDay(task.dueDate)}
            {task.dueTime ? ` ${task.dueTime}` : ""}
          </span>
        )}
      </div>
      {childTasks && childTasks.length > 0 && (
        <ul className={styles.subtasks}>
          {childTasks.map((child) => (
            <TaskRow key={child.id} task={child} today={today} onToggle={onToggle} onOpen={onOpen} selected={false} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TaskBoard({ view, listId, lists }: { view: TaskView; listId?: string; lists: ListOption[] }) {
  const t = strings.tasks;
  const [today] = useState(() => localDay());
  const [tasks, setTasks] = useState<Task[]>();
  const [children, setChildren] = useState<Task[]>([]);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Task>();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    const result = await loadTasksAction({ view, today, listId });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setTasks(result.tasks);
    setChildren(result.subtasks);
  }, [view, today, listId]);

  useEffect(() => {
    let active = true;
    loadTasksAction({ view, today, listId }).then((result) => {
      if (!active) return;
      if ("error" in result) setError(result.error);
      else {
        setTasks(result.tasks);
        setChildren(result.subtasks);
      }
    });
    return () => {
      active = false;
    };
  }, [view, today, listId]);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    start(async () => {
      const result = await createTaskAction({
        title: clean,
        dueDate: view === "today" ? today : null,
        listId: view === "list" ? listId ?? null : null,

      });
      if ("error" in result) setError(result.error);
      else {
        setTitle("");
        await load();
      }
    });
  }

  function toggle(task: Task) {
    start(async () => {
      const result = await setDoneAction(task.id, !task.completedAt);
      if ("error" in result) setError(result.error);
      await load();
    });
  }

  const emptyText = { inbox: t.emptyInbox, today: t.emptyToday, upcoming: t.emptyUpcoming, done: t.emptyDone, list: t.emptyList }[view];

  return (
    <div className={styles.board} data-editing={selected ? true : undefined}>
      <section className={styles.listPanel}>
        {view !== "done" && (
          <form className={styles.add} onSubmit={add}>
            <SurveyMark state="open" />
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.addPlaceholder} aria-label={t.add} maxLength={300} />
            <Button type="submit" variant="primary" icon="plus" disabled={pending || !title.trim()}>
              {t.add}
            </Button>
          </form>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {!tasks && !error && <p className={styles.empty}>{strings.settings.loading}</p>}
        {tasks && tasks.length === 0 && <p className={styles.empty}>{emptyText}</p>}
        {tasks && tasks.length > 0 && (
          <ul className={styles.tasks}>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                subtasks={children.filter((child) => child.parentId === task.id)}
                onToggle={toggle}
                onOpen={setSelected}
                selected={selected?.id === task.id}
              />
            ))}
          </ul>
        )}
      </section>
      {selected && (
        <>
          <TaskEditor key={selected.id} task={selected} lists={lists} onClose={() => setSelected(undefined)} onSaved={() => void load()} />
          {!selected.parentId && <SubtaskAdder parent={selected} onAdded={() => void load()} />}
        </>
      )}
    </div>
  );
}

function SubtaskAdder({ parent, onAdded }: { parent: Task; onAdded: () => void }) {
  const t = strings.tasks;
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className={styles.subtaskAdd}
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        start(async () => {
          const result = await createTaskAction({ title: title.trim(), parentId: parent.id, listId: parent.listId });
          if ("error" in result) setError(result.error);
          else {
            setTitle("");
            onAdded();
          }
        });
      }}
    >
      <h3>{t.subtasks}</h3>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.inline}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.addSubtask} aria-label={t.addSubtask} maxLength={300} />
        <Button type="submit" icon="plus" disabled={pending || !title.trim()}>
          {t.add}
        </Button>
      </div>
    </form>
  );
}
