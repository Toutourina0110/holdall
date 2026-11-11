"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { strings } from "@/core/strings";
import { localDay, shortDay } from "@/ui/dates";
import { SurveyMark } from "@/ui/SurveyMark";
import { useJobs } from "@/ui/useJobs";
import { loadRangeAction, type CalendarItem } from "../calendar/actions";
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

function DownloadsQueue() {
  const t = strings.downloads;
  const { jobs, error } = useJobs("downloader.download");
  const active = (jobs ?? []).filter((job) => job.status === "running" || job.status === "queued").slice(0, 5);
  if (error) return <p className={styles.empty}>{error}</p>;
  if (!jobs) return <p className={styles.empty}>{strings.settings.loading}</p>;
  return (
    <>
      {active.length === 0 && <p className={styles.empty}>{t.widgetEmpty}</p>}
      <ul className={styles.rows}>
        {active.map((job) => {
          const payload = JSON.parse(job.payload) as { url: string; title?: string };
          return (
            <li key={job.id}>
              <span className={`${styles.title} ${styles.padded}`}>{payload.title ?? payload.url}</span>
              <span className={styles.meta}>{job.status === "queued" ? t.queued : `${Math.round(job.progress * 100)}%`}</span>
            </li>
          );
        })}
      </ul>
      <Link className={styles.more} href="/downloads">
        {t.widgetMore}
      </Link>
    </>
  );
}

function CalendarToday() {
  const t = strings.calendar;
  const [events, setEvents] = useState<CalendarItem[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    loadRangeAction(from.toISOString(), to.toISOString())
      .then((result) => {
        if (!active) return;
        if ("error" in result) setError(result.error);
        else setEvents(result.items.filter((item) => item.kind === "event").sort((a, b) => a.start.localeCompare(b.start)));
      })
      .catch(() => active && setError(strings.tasks.loadFailed));
    return () => {
      active = false;
    };
  }, []);
  if (error) return <p className={styles.empty}>{error}</p>;
  if (!events) return <p className={styles.empty}>{strings.settings.loading}</p>;
  return (
    <>
      {events.length === 0 && <p className={styles.empty}>{t.widgetEmpty}</p>}
      <ul className={styles.rows}>
        {events.map((event) => (
          <li key={event.id}>
            <span className={`${styles.title} ${styles.padded}`}>{event.title}</span>
            <span className={styles.meta}>{event.allDay ? t.allDay : new Date(event.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
          </li>
        ))}
      </ul>
      <Link className={styles.more} href="/calendar">
        {t.widgetMore}
      </Link>
    </>
  );
}

export function BuiltinWidget({ component }: { component: string }) {
  if (component === "tasks.today") return <TasksToday />;
  if (component === "downloads.queue") return <DownloadsQueue />;
  if (component === "notes.recent") return <RecentNotes />;
  if (component === "calendar.today") return <CalendarToday />;
  return null;
}
