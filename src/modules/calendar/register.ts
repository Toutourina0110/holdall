import { z } from "zod";
import { registerSlotContributor } from "@/core/layout/registry";
import { registerPluginApi } from "@/core/plugins/api";
import { createEvent, deleteEvent, listEvents, localCalendar, updateEvent } from "./store";
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

registerPluginApi(
  "calendar.update",
  "calendar:write",
  z.object({
    id: z.string().max(64),
    title: z.string().max(300).optional(),
    start: z.coerce.date().optional(),
    end: z.coerce.date().optional(),
    allDay: z.boolean().optional(),
    location: z.string().max(300).optional(),
    description: z.string().max(20000).optional(),
  }),
  ({ id, ...changes }, { userId }) => {
    const event = updateEvent(userId, id, Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)));
    return { id: event.id, title: event.title, start: event.start.toISOString(), end: event.end.toISOString(), allDay: event.allDay, location: event.location };
  },
);

registerPluginApi("calendar.delete", "calendar:write", z.object({ id: z.string().max(64) }), ({ id }, { userId }) => {
  deleteEvent(userId, id);
  return true;
});
