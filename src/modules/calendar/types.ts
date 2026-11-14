export type Provider = "local" | "google" | "microsoft" | "icloud" | "caldav";

export type RemoteCalendar = { remoteId: string; name: string; color?: string; readOnly: boolean };

export type EventFields = {
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  allDay: boolean;
};

export type RemoteEvent = EventFields & {
  remoteId: string;
  etag?: string;
  recurring: boolean;
  updatedAt?: Date;
};

export type Credentials =
  | { kind: "oauth"; accessToken: string; refreshToken: string; expiresAt: number; via?: "relay" }
  | { kind: "basic"; serverUrl: string; username: string; password: string; allowPrivate?: boolean };

export type CalendarProvider = {
  listCalendars(credentials: Credentials): Promise<RemoteCalendar[]>;
  listEvents(credentials: Credentials, calendar: RemoteCalendar, from: Date, to: Date): Promise<RemoteEvent[]>;
  createEvent(credentials: Credentials, calendar: RemoteCalendar, fields: EventFields): Promise<{ remoteId: string; etag?: string }>;
  updateEvent(credentials: Credentials, calendar: RemoteCalendar, remoteId: string, etag: string | undefined, fields: EventFields): Promise<{ etag?: string }>;
  deleteEvent(credentials: Credentials, calendar: RemoteCalendar, remoteId: string, etag: string | undefined): Promise<void>;
};

export type LocalSide = { dirty: boolean; updatedAt: Date };

export function resolveConflict(local: LocalSide, remote: { updatedAt?: Date }): "local" | "remote" {
  if (!local.dirty) return "remote";
  if (!remote.updatedAt) return "local";
  return local.updatedAt.getTime() >= remote.updatedAt.getTime() ? "local" : "remote";
}
