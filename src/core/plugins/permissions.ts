export const permissionCatalog = {
  "notes:read": "Read all your notes",
  "notes:write": "Create, change and delete your notes",
  "tasks:read": "Read all your tasks",
  "tasks:write": "Create, change and delete your tasks",
  "calendar:read": "Read your calendar events",
  "calendar:write": "Create, change and delete your calendar events",
  "files:read": "Read your files",
  "files:write": "Create, change and delete your files",
  "downloads:read": "See your downloads",
  "downloads:create": "Start downloads for you",
  network: "Connect to the internet addresses listed below",
  notifications: "Show you notifications",
  storage: "Keep its own private data on this server",
  "ui:slots": "Add elements to the interface",
  "ui:replace": "Replace elements of the interface, if you accept each one",
} as const;

export type BasePermission = keyof typeof permissionCatalog;

export const hookCatalog = {
  "notes.saved": { kind: "action", permission: "notes:read", description: "Called after a note is saved" },
  "notes.deleted": { kind: "action", permission: "notes:read", description: "Called after a note is moved to the trash" },
  "notes.export.formats": { kind: "filter", permission: "notes:read", description: "Adds export formats to notes" },
  "notes.export.render": { kind: "filter", permission: "notes:read", description: "Turns a note into one of its export formats" },
  "tasks.completed": { kind: "action", permission: "tasks:read", description: "Called after a task is completed" },
  "download.finished": { kind: "action", permission: "downloads:read", description: "Called after a download finishes" },
  "calendar.event.render": { kind: "filter", permission: "calendar:read", description: "Changes how an event is shown" },
  "dashboard.widgets": { kind: "filter", permission: "ui:slots", description: "Chooses which widgets appear on the Today page" },
} as const;

export type HookName = keyof typeof hookCatalog;

export function isKnownPermission(value: string): boolean {
  if (value in permissionCatalog) return true;
  const hook = value.startsWith("hooks:") ? value.slice("hooks:".length) : undefined;
  return hook !== undefined && hook in hookCatalog;
}

export function describePermission(value: string): string {
  if (value in permissionCatalog) return permissionCatalog[value as BasePermission];
  if (value.startsWith("hooks:")) {
    const hook = hookCatalog[value.slice("hooks:".length) as HookName];
    if (hook) return `${hook.description} (${value.slice("hooks:".length)})`;
  }
  return value;
}
