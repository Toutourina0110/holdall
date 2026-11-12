import { z } from "zod";
import { registerSlotContributor } from "@/core/layout/registry";
import { registerPluginApi } from "@/core/plugins/api";
import { createTask, createTaskList, deleteTask, deleteTaskList, listTaskLists, listTasks, renameTaskList, setTaskDone, taskInput, updateTask } from "./store";

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

const taskChanges = z.object({
  id: z.string().max(64),
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  priority: z.number().optional(),
  labels: z.array(z.string()).optional(),
  listId: z.string().max(64).nullable().optional(),
  parentId: z.string().max(64).nullable().optional(),
});

registerPluginApi("tasks.update", "tasks:write", taskChanges, ({ id, ...changes }, { userId }) =>
  updateTask(userId, id, Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))),
);

registerPluginApi("tasks.delete", "tasks:write", z.object({ id: z.string().max(64) }), ({ id }, { userId }) => {
  deleteTask(userId, id);
  return true;
});

registerPluginApi("tasks.lists", "tasks:read", z.object({}), (_params, { userId }) => listTaskLists(userId));

registerPluginApi("tasks.createList", "tasks:write", z.object({ name: z.string().max(100) }), ({ name }, { userId }) => createTaskList(userId, name));

registerPluginApi("tasks.renameList", "tasks:write", z.object({ id: z.string().max(64), name: z.string().max(100) }), ({ id, name }, { userId }) => {
  renameTaskList(userId, id, name);
  return true;
});

registerPluginApi("tasks.deleteList", "tasks:write", z.object({ id: z.string().max(64) }), ({ id }, { userId }) => {
  deleteTaskList(userId, id);
  return true;
});
