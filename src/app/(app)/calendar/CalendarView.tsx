"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { strings } from "@/core/strings";
import { Button, ButtonLink, Field, IconButton, Notice, Segmented } from "@/ui/controls";
import { localDay } from "@/ui/dates";
import { deleteEventAction, loadRangeAction, saveEventAction, type CalendarItem } from "./actions";
import styles from "./calendar.module.css";

type View = "day" | "week" | "month" | "agenda";
type CalendarOption = { id: string; name: string; color: string };

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const day = (date.getDay() + 6) % 7;
  const start = addDays(date, -day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function range(view: View, anchor: Date): { from: Date; to: Date; days: Date[] } {
  const base = new Date(anchor);
  base.setHours(0, 0, 0, 0);
  if (view === "day") return { from: base, to: addDays(base, 1), days: [base] };
  if (view === "week") {
    const from = startOfWeek(base);
    return { from, to: addDays(from, 7), days: Array.from({ length: 7 }, (_, index) => addDays(from, index)) };
  }
  if (view === "agenda") return { from: base, to: addDays(base, 30), days: Array.from({ length: 30 }, (_, index) => addDays(base, index)) };
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const from = startOfWeek(first);
  return { from, to: addDays(from, 42), days: Array.from({ length: 42 }, (_, index) => addDays(from, index)) };
}

function dayKeyOf(item: CalendarItem): string {
  if (item.allDay) return item.start.slice(0, 10);
  return localDay(new Date(item.start));
}

function spans(item: CalendarItem): string[] {
  if (!item.allDay || item.kind === "task") return [dayKeyOf(item)];
  const keys: string[] = [];
  const end = new Date(item.end);
  for (let day = new Date(item.start); day < end && keys.length < 62; day = new Date(day.getTime() + 86400000)) keys.push(day.toISOString().slice(0, 10));
  return keys.length ? keys : [dayKeyOf(item)];
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(value: string, allDay: boolean) {
  if (allDay) return value.slice(0, 10);
  const date = new Date(value);
  return `${localDay(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function title(view: View, anchor: Date, days: Date[]) {
  if (view === "day") return anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (view === "month") return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return `${first.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${last.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

type Draft = { id?: string; calendarId: string; title: string; allDay: boolean; start: string; end: string; location: string; description: string; editable: boolean };

function EventEditor({ draft, calendars, onClose, onSaved }: { draft: Draft; calendars: CalendarOption[]; onClose: () => void; onSaved: () => void }) {
  const t = strings.calendar;
  const [value, setValue] = useState(draft);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const toDate = (input: string) => (value.allDay ? new Date(`${input.slice(0, 10)}T00:00:00Z`) : new Date(input));
    let end = toDate(value.end);
    if (value.allDay && end.getTime() <= toDate(value.start).getTime()) end = new Date(toDate(value.start).getTime() + 86400000);
    start(async () => {
      const result = await saveEventAction(value.id, {
        calendarId: value.calendarId,
        title: value.title,
        allDay: value.allDay,
        start: toDate(value.start),
        end,
        location: value.location,
        description: value.description,
      });
      if ("error" in result) setError(result.error);
      else {
        onSaved();
        onClose();
      }
    });
  }

  return (
    <form className={styles.editor} onSubmit={submit} aria-label={value.id ? t.editEvent : t.newEvent}>
      <header className={styles.editorHead}>
        <h2>{value.id ? t.editEvent : t.newEvent}</h2>
        <IconButton icon="x" label={t.close} onClick={onClose} />
      </header>
      <div className={styles.editorBody}>
        {!value.editable && <Notice tone="warn">{t.readOnly}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <Field label={t.titleLabel} name="title" value={value.title} required maxLength={300} readOnly={!value.editable} onChange={(event) => setValue({ ...value, title: event.target.value })} />
        <label className={styles.fieldLike}>
          <span>{t.calendarLabel}</span>
          <select className={styles.select} value={value.calendarId} disabled={!value.editable} onChange={(event) => setValue({ ...value, calendarId: event.target.value })}>
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value.allDay}
            disabled={!value.editable}
            onChange={(event) => setValue({ ...value, allDay: event.target.checked, start: value.start.slice(0, 10) + (event.target.checked ? "" : "T09:00"), end: value.end.slice(0, 10) + (event.target.checked ? "" : "T10:00") })}
          />
          {t.allDay}
        </label>
        <div className={styles.row2}>
          <Field label={t.starts} name="start" type={value.allDay ? "date" : "datetime-local"} value={value.start} readOnly={!value.editable} required onChange={(event) => setValue({ ...value, start: event.target.value })} />
          <Field label={t.ends} name="end" type={value.allDay ? "date" : "datetime-local"} value={value.end} readOnly={!value.editable} required onChange={(event) => setValue({ ...value, end: event.target.value })} />
        </div>
        <Field label={t.location} name="location" value={value.location} maxLength={300} readOnly={!value.editable} onChange={(event) => setValue({ ...value, location: event.target.value })} />
        <Field label={t.description} name="description" multiline value={value.description} readOnly={!value.editable} onChange={(event) => setValue({ ...value, description: event.target.value })} />
      </div>
      {value.editable && (
        <footer className={styles.editorFoot}>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {t.save}
          </Button>
          {value.id && (
            <Button
              variant="danger"
              icon="trash"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(t.deleteConfirm)) return;
                start(async () => {
                  const result = await deleteEventAction(value.id!);
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
          )}
        </footer>
      )}
    </form>
  );
}

function Chip({ item, onOpen, compact }: { item: CalendarItem; onOpen: (item: CalendarItem) => void; compact?: boolean }) {
  const content = (
    <>
      {!item.allDay && <span className={styles.chipTime}>{time(item.start)}</span>}
      <span className={styles.chipTitle}>{item.title}</span>
    </>
  );
  if (item.kind === "task") {
    return (
      <Link href="/tasks" className={styles.chip} data-kind="task" data-compact={compact || undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.chip} style={{ "--event-color": item.color } as CSSProperties} data-compact={compact || undefined} onClick={() => onOpen(item)}>
      {content}
    </button>
  );
}

export function CalendarView({ calendars }: { calendars: CalendarOption[] }) {
  const t = strings.calendar;
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [items, setItems] = useState<CalendarItem[]>();
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<Draft>();
  const { from, to, days } = useMemo(() => range(view, anchor), [view, anchor]);
  const today = localDay();
  const grid = useRef<HTMLDivElement>(null);
  const timed = items !== undefined && (view === "week" || view === "day");

  useEffect(() => {
    const node = grid.current;
    if (!timed || !node) return;
    const hour = node.querySelector<HTMLElement>("[data-hour='7']");
    const head = node.querySelector<HTMLElement>("[data-head]");
    if (hour && head) node.scrollTop = hour.getBoundingClientRect().top - node.getBoundingClientRect().top - head.offsetHeight;
  }, [timed, view]);

  const load = useCallback(async () => {
    const result = await loadRangeAction(from.toISOString(), to.toISOString());
    if ("error" in result) setError(result.error);
    else {
      setError(undefined);
      setItems(result.items);
    }
  }, [from, to]);

  useEffect(() => {
    let active = true;
    loadRangeAction(from.toISOString(), to.toISOString()).then((result) => {
      if (!active) return;
      if ("error" in result) setError(result.error);
      else setItems(result.items);
    });
    return () => {
      active = false;
    };
  }, [from, to]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items ?? []) for (const key of spans(item)) map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, [items]);

  function move(step: number) {
    const next = new Date(anchor);
    if (view === "day") next.setDate(next.getDate() + step);
    else if (view === "week") next.setDate(next.getDate() + step * 7);
    else if (view === "agenda") next.setDate(next.getDate() + step * 30);
    else next.setMonth(next.getMonth() + step);
    setAnchor(next);
  }

  function newDraft(day?: Date, hour = 9) {
    const base = day ?? new Date();
    const key = localDay(base);
    setDraft({
      calendarId: calendars[0]?.id ?? "",
      title: "",
      allDay: false,
      start: `${key}T${String(hour).padStart(2, "0")}:00`,
      end: `${key}T${String(Math.min(hour + 1, 23)).padStart(2, "0")}:00`,
      location: "",
      description: "",
      editable: true,
    });
  }

  function open(item: CalendarItem) {
    setDraft({
      id: item.id,
      calendarId: item.calendarId ?? calendars[0]?.id ?? "",
      title: item.title,
      allDay: item.allDay,
      start: toLocalInput(item.start, item.allDay),
      end: toLocalInput(item.allDay ? new Date(new Date(item.end).getTime() - 86400000).toISOString() : item.end, item.allDay),
      location: item.location ?? "",
      description: item.description ?? "",
      editable: item.editable && calendars.some((calendar) => calendar.id === item.calendarId),
    });
  }

  return (
    <div className={styles.layout} data-editing={draft ? true : undefined}>
      <section className={styles.main}>
        <header className={styles.toolbar}>
          <div className={styles.navGroup}>
            <Button onClick={() => setAnchor(new Date())}>{t.today}</Button>
            <IconButton icon="back" label={t.previous} onClick={() => move(-1)} />
            <span className={styles.flip}>
              <IconButton icon="back" label={t.next} onClick={() => move(1)} />
            </span>
            <h1 className={styles.period}>{title(view, anchor, days)}</h1>
          </div>
          <div className={styles.navGroup}>
            <Segmented
              label={t.title}
              value={view}
              onChange={setView}
              options={[
                { value: "day", label: t.day },
                { value: "week", label: t.week },
                { value: "month", label: t.month },
                { value: "agenda", label: t.agenda },
              ]}
            />
            <ButtonLink href="/calendar/accounts" icon="sync">
              {t.accounts}
            </ButtonLink>
            <Button variant="primary" icon="plus" onClick={() => newDraft(view === "day" ? anchor : undefined)}>
              {t.newEvent}
            </Button>
          </div>
        </header>
        {error && <Notice tone="error">{error}</Notice>}
        {!items && !error && <p className={styles.empty}>{strings.settings.loading}</p>}
        {items && view === "month" && (
          <div className={styles.month}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
              <div key={name} className={styles.weekday}>
                {name}
              </div>
            ))}
            {days.map((day) => {
              const key = localDay(day);
              const list = byDay.get(key) ?? [];
              return (
                <div key={key} className={styles.cell} data-outside={day.getMonth() !== anchor.getMonth() || undefined} data-today={key === today || undefined}>
                  <button
                    type="button"
                    className={styles.dayNumber}
                    aria-label={day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    onClick={() => {
                      setAnchor(day);
                      setView("day");
                    }}
                  >
                    {day.getDate()}
                  </button>
                  {list.slice(0, 3).map((item) => (
                    <Chip key={`${item.kind}${item.id}${key}`} item={item} onOpen={open} compact />
                  ))}
                  {list.length > 3 && (
                    <button
                      type="button"
                      className={styles.more}
                      onClick={() => {
                        setAnchor(day);
                        setView("day");
                      }}
                    >
                      {t.more.replace("{count}", String(list.length - 3))}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {items && (view === "week" || view === "day") && (
          <div ref={grid} className={styles.timeGrid} data-single={days.length === 1 || undefined} style={{ "--columns": days.length } as CSSProperties}>
            <div className={styles.corner} data-head />
            {days.map((day) => (
              <div key={day.toISOString()} className={styles.colHead} data-today={localDay(day) === today || undefined}>
                <span>{day.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                <b>{day.getDate()}</b>
              </div>
            ))}
            <div className={styles.corner} />
            {days.map((day) => (
              <div key={`all${day.toISOString()}`} className={styles.allDay}>
                {(byDay.get(localDay(day)) ?? [])
                  .filter((item) => item.allDay)
                  .map((item) => (
                    <Chip key={`${item.kind}${item.id}`} item={item} onOpen={open} compact />
                  ))}
              </div>
            ))}
            <div className={styles.hours}>
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour} data-hour={hour}>
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((day) => {
              const key = localDay(day);
              return (
                <div key={`col${key}`} className={styles.column}>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <button key={hour} type="button" className={styles.slot} tabIndex={-1} aria-hidden="true" onClick={() => newDraft(day, hour)} />
                  ))}
                  {(byDay.get(key) ?? [])
                    .filter((item) => !item.allDay)
                    .map((item) => {
                      const start = new Date(item.start);
                      const end = new Date(item.end);
                      const at = start.getHours() + start.getMinutes() / 60;
                      const span = Math.min(24 - at, (end.getTime() - start.getTime()) / 3600000);
                      return (
                        <div key={`${item.kind}${item.id}`} className={styles.placed} style={{ "--at": at, "--span": span } as CSSProperties}>
                          <Chip item={item} onOpen={open} />
                        </div>
                      );
                    })}
                  {key === today && <span className={styles.now} style={{ "--at": new Date().getHours() + new Date().getMinutes() / 60 } as CSSProperties} />}
                </div>
              );
            })}
          </div>
        )}
        {items && view === "agenda" && (
          <ol className={styles.agenda}>
            {days.filter((day) => (byDay.get(localDay(day)) ?? []).length > 0).length === 0 && <li className={styles.empty}>{t.noEvents}</li>}
            {days.map((day) => {
              const list = byDay.get(localDay(day)) ?? [];
              if (list.length === 0) return null;
              return (
                <li key={day.toISOString()} className={styles.agendaDay}>
                  <h2 data-today={localDay(day) === today || undefined}>{day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
                  <div className={styles.agendaItems}>
                    {list.map((item) => (
                      <Chip key={`${item.kind}${item.id}`} item={item} onOpen={open} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      {draft && <EventEditor key={draft.id ?? `${draft.start}`} draft={draft} calendars={calendars} onClose={() => setDraft(undefined)} onSaved={() => void load()} />}
    </div>
  );
}
