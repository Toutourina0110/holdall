import { z } from "zod";
import { registerSlotContributor } from "@/core/layout/registry";
import { registerPluginApi } from "@/core/plugins/api";
import { createTask, listTasks, setTaskDone, taskInput } from "./store";

registerSlotContributor("tasks", () => [
  { id: "tasks.page", slot: "rail.main", label: "Tasks", icon: "tasks", href: "/tasks", order: 20, source: "tasks" },
  { id: "tasks.today", slot: "dashboard.widgets", label: "Due today", icon: "tasks", order: 10, source: "tasks", builtin: { component: "tasks.today", width: 1 } },
]);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

registerPluginApi(
  "tasks.list",
  "tasks:read",
  z.object({ view: z.enum(["inbox", "today", "upcoming", "done"]).default("today"), today: day }),
  ({ view, today }, { userId }) => listTasks(userId, view, today),
);

registerPluginApi("tasks.create", "tasks:write", taskInput, (input, { userId }) => createTask(userId, input));

registerPluginApi("tasks.complete", "tasks:write", z.object({ id: z.string().max(64), done: z.boolean() }), ({ id, done }, { userId }) =>
  setTaskDone(userId, id, done),
);
