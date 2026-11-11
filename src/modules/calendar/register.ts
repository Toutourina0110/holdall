import { z } from "zod";
import { registerSlotContributor } from "@/core/layout/registry";
import { registerPluginApi } from "@/core/plugins/api";
import { createEvent, listEvents, localCalendar } from "./store";
import "./sync";

registerSlotContributor("calendar", () => [
  { id: "calendar.page", slot: "rail.main", label: "Calendar", icon: "calendar", href: "/calendar", order: 30, source: "calendar" },
  { id: "calendar.today", slot: "dashboard.widgets", label: "Agenda", icon: "calendar", order: 5, source: "calendar", builtin: { component: "calendar.today", width: 1 } },
]);

registerPluginApi("calendar.list", "calendar:read", z.object({ from: z.coerce.date(), to: z.coerce.date() }), ({ from, to }, { userId }) =>
  listEvents(userId, from, to).map((event) => ({ id: event.id, title: event.title, start: event.start.toISOString(), end: event.end.toISOString(), allDay: event.allDay, location: event.location })),
);

registerPluginApi(
  "calendar.create",
  "calendar:write",
  z.object({ title: z.string().max(300), start: z.coerce.date(), end: z.coerce.date(), allDay: z.boolean().default(false), location: z.string().max(300).default(""), description: z.string().max(20000).default("") }),
  (input, { userId }) => {
    const event = createEvent(userId, { ...input, calendarId: localCalendar(userId).id });
    return { id: event.id };
  },
);
