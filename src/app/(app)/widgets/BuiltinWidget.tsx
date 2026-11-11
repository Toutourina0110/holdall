"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { localDay, shortDay } from "@/ui/dates";
import { SurveyMark } from "@/ui/SurveyMark";
import { setDoneAction } from "../tasks/actions";
import { recentNotesAction, todayTasksAction } from "./actions";
import styles from "./widgets.module.css";

type TodayTask = { id: string; title: string; dueDate: string | null; dueTime: string | null };

function TasksToday() {
  const t = strings.tasks;
  const [today] = useState(() => localDay());
  const [tasks, setTasks] = useState<TodayTask[]>();
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    let active = true;
    todayTasksAction(today)
      .then((rows) => active && setTasks(rows))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [today]);

  if (failed) return <p className={styles.empty}>{t.loadFailed}</p>;
  if (!tasks) return <p className={styles.empty}>{strings.settings.loading}</p>;
  return (
    <>
      {tasks.length === 0 && <p className={styles.empty}>{t.widgetEmpty}</p>}
      <ul className={styles.rows}>
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              className={styles.check}
              aria-label={`${t.complete}: ${task.title}`}
              onClick={() =>
                start(async () => {
                  await setDoneAction(task.id, true);
                  setTasks((current) => current?.filter((item) => item.id !== task.id));
                })
              }
            >
              <SurveyMark state={task.dueDate && task.dueDate < today ? "late" : "open"} size={18} />
            </button>
            <span className={styles.title}>{task.title}</span>
            <span className={styles.meta} data-late={task.dueDate && task.dueDate < today ? true : undefined}>
              {task.dueDate && task.dueDate < today ? shortDay(task.dueDate) : task.dueTime ?? ""}
            </span>
          </li>
        ))}
      </ul>
      <Link className={styles.more} href="/tasks?view=today">
        {t.widgetMore}
      </Link>
    </>
  );
}

function RecentNotes() {
  const t = strings.notes;
  const [notes, setNotes] = useState<{ id: string; title: string; updatedAt: string }[]>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    recentNotesAction()
      .then((rows) => active && setNotes(rows))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);
  if (failed) return <p className={styles.empty}>{strings.tasks.loadFailed}</p>;
  if (!notes) return <p className={styles.empty}>{strings.settings.loading}</p>;
  return (
    <>
      {notes.length === 0 && <p className={styles.empty}>{t.emptyList}</p>}
      <ul className={styles.rows}>
        {notes.map((note) => (
          <li key={note.id}>
            <Link className={styles.title} href={`/notes?id=${note.id}`}>
              {note.title}
            </Link>
            <span className={styles.meta}>{new Date(note.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          </li>
        ))}
      </ul>
      <Link className={styles.more} href="/notes">
        {t.all}
      </Link>
    </>
  );
}

export function BuiltinWidget({ component }: { component: string }) {
  if (component === "tasks.today") return <TasksToday />;
  if (component === "notes.recent") return <RecentNotes />;
  return null;
}
