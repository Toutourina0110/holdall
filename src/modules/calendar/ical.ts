import ICAL from "ical.js";
import type { EventFields, RemoteEvent } from "./types";

function toDate(time: ICAL.Time): Date {
  return time.isDate ? new Date(Date.UTC(time.year, time.month - 1, time.day)) : time.toJSDate();
}

export function parseEvents(ics: string, remoteId: string, etag: string | undefined, from: Date, to: Date): RemoteEvent[] {
  const component = new ICAL.Component(ICAL.parse(ics));
  const events: RemoteEvent[] = [];
  const vevents = component.getAllSubcomponents("vevent");
  const master = vevents.find((item) => !item.hasProperty("recurrence-id")) ?? vevents[0];
  if (!master) return events;
  const event = new ICAL.Event(master);
  for (const exception of vevents.filter((item) => item.hasProperty("recurrence-id"))) event.relateException(exception);
  const updated = master.getFirstPropertyValue("last-modified") as ICAL.Time | null;
  const base = {
    title: String(event.summary ?? "").slice(0, 300) || "Untitled",
    description: String(event.description ?? "").slice(0, 20000),
    location: String(event.location ?? "").slice(0, 300),
    etag,
    updatedAt: updated ? updated.toJSDate() : undefined,
  };
  if (!event.isRecurring()) {
    events.push({ ...base, remoteId, start: toDate(event.startDate), end: toDate(event.endDate), allDay: event.startDate.isDate, recurring: false });
    return events;
  }
  const iterator = event.iterator();
  for (let next = iterator.next(), count = 0; next && count < 500; next = iterator.next(), count++) {
    const start = toDate(next);
    if (start > to) break;
    const details = event.getOccurrenceDetails(next);
    const end = toDate(details.endDate);
    if (end < from) continue;
    events.push({
      ...base,
      title: String(details.item.summary ?? base.title).slice(0, 300),
      remoteId: `${remoteId}#${next.toICALString()}`,
      start: toDate(details.startDate),
      end,
      allDay: details.startDate.isDate,
      recurring: true,
    });
  }
  return events;
}

function icalTime(date: Date, allDay: boolean): ICAL.Time {
  if (allDay) return ICAL.Time.fromData({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), isDate: true });
  return ICAL.Time.fromJSDate(date, true);
}

export function buildEvent(uid: string, fields: EventFields): string {
  const calendar = new ICAL.Component(["vcalendar", [], []]);
  calendar.updatePropertyWithValue("prodid", "-//Holdall//Calendar//EN");
  calendar.updatePropertyWithValue("version", "2.0");
  const vevent = new ICAL.Component("vevent");
  const event = new ICAL.Event(vevent);
  event.uid = uid;
  event.summary = fields.title;
  if (fields.description) event.description = fields.description;
  if (fields.location) event.location = fields.location;
  event.startDate = icalTime(fields.start, fields.allDay);
  event.endDate = icalTime(fields.end, fields.allDay);
  vevent.updatePropertyWithValue("dtstamp", ICAL.Time.fromJSDate(new Date(), true));
  vevent.updatePropertyWithValue("last-modified", ICAL.Time.fromJSDate(new Date(), true));
  calendar.addSubcomponent(vevent);
  return calendar.toString();
}
