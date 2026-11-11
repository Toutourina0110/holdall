export const permissions = [
  "notes:read",
  "notes:write",
  "tasks:read",
  "tasks:write",
  "calendar:read",
  "calendar:write",
  "files:read",
  "files:write",
  "downloads:read",
  "downloads:create",
  "network",
  "notifications",
  "storage",
  "ui:slots",
  "ui:replace",
] as const;

export const hooks = ["notes.saved", "notes.deleted", "notes.export.formats", "tasks.completed", "download.finished", "calendar.event.render", "dashboard.widgets"] as const;

export type BasePermission = (typeof permissions)[number];
export type HookName = (typeof hooks)[number];
export type Permission = BasePermission | `hooks:${HookName}`;

export type Manifest = {
  id: string;
  name: string;
  version: string;
  type: "module" | "extension" | "library" | "theme";
  description?: string;
  author: { name: string; url?: string };
  license: string;
  holdall: string;
  permissions?: Permission[];
  optionalPermissions?: Permission[];
  network?: string[];
  dependencies?: Record<string, string>;
  entry?: { server?: string; ui?: string };
  theme?: string;
  contributes?: {
    hooks?: HookName[];
    slots?: string[];
    widgets?: { id: string; title: string; entry: string; width?: 1 | 2 | 3 }[];
    page?: { title: string; entry: string };
    settings?: string;
  };
};

export type NoteSummary = { id: string; title: string; folder: string; tags: string[]; updatedAt: string };
export type Note = NoteSummary & { content: string };
export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: number;
  labels: string[];
  done: boolean;
};
export type TaskInput = {
  title: string;
  description?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: 0 | 1 | 2 | 3;
  labels?: string[];
};
export type CalendarEvent = { id: string; title: string; start: string; end: string; allDay: boolean; location: string };
export type FetchResult = { status: number; headers: Record<string, string>; body: string };

export type Methods = {
  "theme.tokens": { params: undefined; result: Record<string, string> };
  "storage.get": { params: { key: string }; result: unknown };
  "storage.set": { params: { key: string; value: unknown }; result: true };
  "storage.delete": { params: { key: string }; result: true };
  "network.fetch": { params: { url: string; method?: string; headers?: Record<string, string>; body?: string }; result: FetchResult };
  "notes.list": { params: { query?: string }; result: NoteSummary[] };
  "notes.get": { params: { id: string }; result: Note | null };
  "notes.create": { params: { title: string; folder?: string; content?: string }; result: NoteSummary };
  "notes.update": { params: { id: string; title?: string; content?: string }; result: NoteSummary };
  "tasks.list": { params: { view?: "inbox" | "today" | "upcoming" | "done"; today: string }; result: Task[] };
  "tasks.create": { params: TaskInput; result: Task };
  "tasks.complete": { params: { id: string; done: boolean }; result: Task };
  "downloads.list": { params: undefined; result: { id: string; status: string; progress: number; result: unknown }[] };
  "calendar.list": { params: { from: string; to: string }; result: CalendarEvent[] };
  "calendar.create": {
    params: { title: string; start: string; end: string; allDay?: boolean; location?: string; description?: string };
    result: { id: string };
  };
};

export type MethodName = keyof Methods;

export type HookContext = { userId: string; callId: string };

export type Holdall = {
  on<P = unknown, R = unknown>(hook: HookName, handler: (payload: P, context: HookContext) => R | Promise<R>): void;
  api<M extends MethodName>(method: M, params: Methods[M]["params"], context: HookContext): Promise<Methods[M]["result"]>;
  storage: {
    get(key: string, context: HookContext): Promise<unknown>;
    set(key: string, value: unknown, context: HookContext): Promise<true>;
    delete(key: string, context: HookContext): Promise<true>;
  };
  fetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } | undefined, context: HookContext): Promise<FetchResult>;
  log(message: string): void;
};

export function definePlugin(setup: (holdall: Holdall) => void | Promise<void>): (holdall: Holdall) => void | Promise<void> {
  return setup;
}

export function defineManifest(manifest: Manifest): Manifest {
  return manifest;
}
