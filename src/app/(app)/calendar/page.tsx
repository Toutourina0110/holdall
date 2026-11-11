import type { Metadata } from "next";
import { requireSession } from "@/core/auth/session";
import { strings } from "@/core/strings";
import { listCalendars } from "@/modules/calendar/store";
import { CalendarView } from "./CalendarView";

export const metadata: Metadata = { title: strings.calendar.title };

export default async function CalendarPage() {
  const session = await requireSession();
  const calendars = listCalendars(session.user.id)
    .filter((item) => item.enabled && !item.readOnly)
    .map((item) => ({ id: item.id, name: item.provider === "local" ? item.name : `${item.name} (${item.accountName})`, color: item.color }));
  return <CalendarView calendars={calendars} />;
}
