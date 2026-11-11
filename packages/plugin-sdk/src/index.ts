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

export const hooks = [
  "notes.saved",
  "notes.deleted",
  "notes.export.formats",
  "notes.export.render",
  "tasks.completed",
  "download.finished",
  "calendar.event.render",
  "dashboard.widgets",
] as const;

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
export type FileEntry = { name: string; path: string; kind: "folder" | "file"; size: number; modified: string; type: "folder" | "image" | "video" | "audio" | "pdf" | "text" | "other" };
export type DownloadOptions = {
  kind: "video" | "audio";
  container?: "mp4" | "webm" | "mkv";
  quality?: "best" | "2160" | "1440" | "1080" | "720" | "480" | "360";
  audioFormat?: "mp3" | "m4a" | "opus";
};
export type ExportFormat = { id: string; label: string; extension: string };
export type WidgetRef = { id: string; label: string };
export type RenderedEvent = { id: string; title: string; color: string };

export type HookPayloads = {
  "notes.saved": { payload: { id: string; title: string }; result: void };
  "notes.deleted": { payload: { id: string }; result: void };
  "notes.export.formats": { payload: ExportFormat[]; result: ExportFormat[] };
  "notes.export.render": { payload: { format: string; note: { id: string; title: string; content: string } }; result: { content: string } };
  "tasks.completed": { payload: { id: string; title: string }; result: void };
  "download.finished": { payload: { id: string; file: string; title?: string }; result: void };
  "calendar.event.render": { payload: RenderedEvent[]; result: RenderedEvent[] };
  "dashboard.widgets": { payload: WidgetRef[]; result: WidgetRef[] };
};

export type Methods = {
  "theme.tokens": { params: undefined; result: Record<string, string> };
  "server.call": { params: { name: string; args?: unknown }; result: unknown };
  "events.subscribe": { params: undefined; result: true };
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
  "downloads.create": { params: { url: string; title?: string; options?: DownloadOptions }; result: { id: string } };
  "files.list": { params: { root?: "files" | "downloads"; path?: string }; result: FileEntry[] };
  "files.read": { params: { root?: "files" | "downloads"; path: string; encoding?: "utf8" | "base64" }; result: { content: string; size: number } };
  "files.write": { params: { path: string; content: string; encoding?: "utf8" | "base64"; overwrite?: boolean }; result: { path: string; size: number } };
  "files.delete": { params: { path: string }; result: true };
  "notifications.show": { params: { title: string; body?: string }; result: true };
  "calendar.list": { params: { from: string; to: string }; result: CalendarEvent[] };
  "calendar.create": {
    params: { title: string; start: string; end: string; allDay?: boolean; location?: string; description?: string };
    result: { id: string };
  };
};

export type MethodName = keyof Methods;

export type HookContext = { userId: string; callId: string };

export type Holdall = {
  on<H extends HookName>(hook: H, handler: (payload: HookPayloads[H]["payload"], context: HookContext) => HookPayloads[H]["result"] | Promise<HookPayloads[H]["result"]>): void;
  handle<A = unknown, R = unknown>(name: string, handler: (args: A, context: HookContext) => R | Promise<R>): void;
  push(userId: string, event: string, data?: unknown): void;
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
