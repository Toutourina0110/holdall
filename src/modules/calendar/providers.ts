import { randomUUID } from "node:crypto";
import net from "node:net";
import { createDAVClient, type DAVCalendar } from "tsdav";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { safeFetch } from "@/core/security/safe-fetch";
import { buildEvent, parseEvents } from "./ical";
import type { CalendarProvider, Credentials, EventFields, Provider, RemoteCalendar, RemoteEvent } from "./types";

type OAuth = Extract<Credentials, { kind: "oauth" }>;
type Basic = Extract<Credentials, { kind: "basic" }>;

async function json<T>(url: string, options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string>; form?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  let body: string | undefined;
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.form).toString();
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await safeFetch(url, { method: options.method ?? "GET", headers, body, maxBytes: 10 * 1024 * 1024, timeoutMs: 30000 });
  if (response.status === 401) throw new UserFacingError("The calendar service refused the saved sign-in. Connect the account again.");
  if (response.status >= 400) throw new UserFacingError(`The calendar service answered with an error (${response.status}). Try again later.`);
  return (response.body.length ? JSON.parse(response.body.toString("utf8")) : {}) as T;
}

function asOAuth(credentials: Credentials): OAuth {
  if (credentials.kind !== "oauth") throw new UserFacingError("This account needs to be connected again.");
  return credentials;
}

function asBasic(credentials: Credentials): Basic {
  if (credentials.kind !== "basic") throw new UserFacingError("This account needs to be added again.");
  return credentials;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type GoogleTime = { dateTime?: string; date?: string };

function googleTime(value: GoogleTime): { date: Date; allDay: boolean } {
  if (value.date) return { date: new Date(`${value.date}T00:00:00Z`), allDay: true };
  return { date: new Date(value.dateTime ?? 0), allDay: false };
}

function googleBody(fields: EventFields) {
  const time = (date: Date) => (fields.allDay ? { date: dateOnly(date) } : { dateTime: date.toISOString() });
  return { summary: fields.title, description: fields.description, location: fields.location, start: time(fields.start), end: time(fields.end) };
}

const googleBase = "https://www.googleapis.com/calendar/v3";

export const google: CalendarProvider = {
  async listCalendars(credentials) {
    const data = await json<{ items?: { id: string; summary?: string; backgroundColor?: string; accessRole?: string }[] }>(`${googleBase}/users/me/calendarList`, {
      token: asOAuth(credentials).accessToken,
    });
    return (data.items ?? []).map((item) => ({
      remoteId: item.id,
      name: item.summary ?? item.id,
      color: item.backgroundColor,
      readOnly: item.accessRole === "reader" || item.accessRole === "freeBusyReader",
    }));
  },
  async listEvents(credentials, calendar, from, to) {
    const events: RemoteEvent[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", maxResults: "2500" });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await json<{
        nextPageToken?: string;
        items?: { id: string; etag?: string; status?: string; summary?: string; description?: string; location?: string; start: GoogleTime; end: GoogleTime; updated?: string; recurringEventId?: string }[];
      }>(`${googleBase}/calendars/${encodeURIComponent(calendar.remoteId)}/events?${params}`, { token: asOAuth(credentials).accessToken });
      for (const item of data.items ?? []) {
        if (item.status === "cancelled") continue;
        const start = googleTime(item.start);
        events.push({
          remoteId: item.id,
          etag: item.etag,
          title: item.summary ?? "Untitled",
          description: item.description ?? "",
          location: item.location ?? "",
          start: start.date,
          end: googleTime(item.end).date,
          allDay: start.allDay,
          recurring: Boolean(item.recurringEventId),
          updatedAt: item.updated ? new Date(item.updated) : undefined,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken && events.length < 5000);
    return events;
  },
  async createEvent(credentials, calendar, fields) {
    const data = await json<{ id: string; etag?: string }>(`${googleBase}/calendars/${encodeURIComponent(calendar.remoteId)}/events`, {
      method: "POST",
      token: asOAuth(credentials).accessToken,
      body: googleBody(fields),
    });
    return { remoteId: data.id, etag: data.etag };
  },
  async updateEvent(credentials, calendar, remoteId, _etag, fields) {
    const data = await json<{ etag?: string }>(`${googleBase}/calendars/${encodeURIComponent(calendar.remoteId)}/events/${encodeURIComponent(remoteId)}`, {
      method: "PATCH",
      token: asOAuth(credentials).accessToken,
      body: googleBody(fields),
    });
    return { etag: data.etag };
  },
  async deleteEvent(credentials, calendar, remoteId) {
    await json(`${googleBase}/calendars/${encodeURIComponent(calendar.remoteId)}/events/${encodeURIComponent(remoteId)}`, {
      method: "DELETE",
      token: asOAuth(credentials).accessToken,
    });
  },
};

const graphBase = "https://graph.microsoft.com/v1.0";

type GraphEvent = {
  id: string;
  "@odata.etag"?: string;
  subject?: string;
  body?: { content?: string; contentType?: string };
  bodyPreview?: string;
  location?: { displayName?: string };
  start: { dateTime: string };
  end: { dateTime: string };
  isAllDay?: boolean;
  lastModifiedDateTime?: string;
  type?: string;
};

function graphBody(fields: EventFields) {
  const time = (date: Date) => ({ dateTime: fields.allDay ? `${dateOnly(date)}T00:00:00` : date.toISOString().replace("Z", ""), timeZone: "UTC" });
  return {
    subject: fields.title,
    body: { contentType: "text", content: fields.description },
    location: { displayName: fields.location },
    start: time(fields.start),
    end: time(fields.end),
    isAllDay: fields.allDay,
  };
}

export const microsoft: CalendarProvider = {
  async listCalendars(credentials) {
    const data = await json<{ value?: { id: string; name: string; hexColor?: string; canEdit?: boolean }[] }>(`${graphBase}/me/calendars`, {
      token: asOAuth(credentials).accessToken,
    });
    return (data.value ?? []).map((item) => ({ remoteId: item.id, name: item.name, color: item.hexColor || undefined, readOnly: item.canEdit === false }));
  },
  async listEvents(credentials, calendar, from, to) {
    const events: RemoteEvent[] = [];
    let url: string | undefined =
      `${graphBase}/me/calendars/${encodeURIComponent(calendar.remoteId)}/calendarView?` +
      new URLSearchParams({ startDateTime: from.toISOString(), endDateTime: to.toISOString(), $top: "500" });
    while (url && events.length < 5000) {
      const data: { value?: GraphEvent[]; "@odata.nextLink"?: string } = await json(url, {
        token: asOAuth(credentials).accessToken,
        headers: { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"' },
      });
      for (const item of data.value ?? []) {
        events.push({
          remoteId: item.id,
          etag: item["@odata.etag"],
          title: item.subject || "Untitled",
          description: item.body?.content ?? item.bodyPreview ?? "",
          location: item.location?.displayName ?? "",
          start: new Date(`${item.start.dateTime.replace(/Z?$/, "")}Z`),
          end: new Date(`${item.end.dateTime.replace(/Z?$/, "")}Z`),
          allDay: Boolean(item.isAllDay),
          recurring: item.type === "occurrence" || item.type === "exception",
          updatedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
        });
      }
      const next = data["@odata.nextLink"];
      url = next && next.startsWith(`${graphBase}/`) ? next : undefined;
    }
    return events;
  },
  async createEvent(credentials, calendar, fields) {
    const data = await json<GraphEvent>(`${graphBase}/me/calendars/${encodeURIComponent(calendar.remoteId)}/events`, {
      method: "POST",
      token: asOAuth(credentials).accessToken,
      body: graphBody(fields),
    });
    return { remoteId: data.id, etag: data["@odata.etag"] };
  },
  async updateEvent(credentials, _calendar, remoteId, _etag, fields) {
    const data = await json<GraphEvent>(`${graphBase}/me/events/${encodeURIComponent(remoteId)}`, {
      method: "PATCH",
      token: asOAuth(credentials).accessToken,
      body: graphBody(fields),
    });
    return { etag: data["@odata.etag"] };
  },
  async deleteEvent(credentials, _calendar, remoteId) {
    await json(`${graphBase}/me/events/${encodeURIComponent(remoteId)}`, { method: "DELETE", token: asOAuth(credentials).accessToken });
  },
};

function siteOf(hostname: string): string {
  if (net.isIP(hostname.replace(/^\[|\]$/g, ""))) return hostname;
  return hostname.split(".").slice(-2).join(".").toLowerCase();
}

export function davFetch(serverUrl: string, allowPrivate: boolean): typeof fetch {
  const site = siteOf(new URL(serverUrl).hostname);
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (siteOf(url.hostname) !== site) throw new UserFacingError("The CalDAV server pointed to another site, which is not followed.");
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = typeof init?.body === "string" ? init.body : undefined;
    if (allowPrivate) return fetch(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(30000) });
    const response = await safeFetch(url.href, { method, headers, body, maxBytes: 20 * 1024 * 1024, timeoutMs: 30000, manualRedirect: true });
    const empty = [101, 204, 205, 304].includes(response.status);
    return new Response(empty ? null : new Uint8Array(response.body), { status: response.status, headers: response.headers });
  }) as typeof fetch;
}

async function davClient(credentials: Credentials) {
  const basic = asBasic(credentials);
  try {
    return await createDAVClient({
      serverUrl: basic.serverUrl,
      credentials: { username: basic.username, password: basic.password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
      fetch: davFetch(basic.serverUrl, Boolean(basic.allowPrivate)),
    });
  } catch {
    throw new UserFacingError("The CalDAV server refused the connection. Check the address, user name and app password.");
  }
}

async function davCalendar(credentials: Credentials, remoteId: string): Promise<{ client: Awaited<ReturnType<typeof davClient>>; calendar: DAVCalendar }> {
  const client = await davClient(credentials);
  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((item) => item.url === remoteId);
  if (!calendar) throw new UserFacingError("This calendar does not exist on the server anymore.");
  return { client, calendar };
}

function objectUrl(remoteId: string): string {
  return remoteId.split("#")[0]!;
}

export const caldav: CalendarProvider = {
  async listCalendars(credentials) {
    const client = await davClient(credentials);
    const calendars = await client.fetchCalendars();
    return calendars
      .filter((item) => !item.components || item.components.includes("VEVENT"))
      .map((item) => ({
        remoteId: item.url,
        name: typeof item.displayName === "string" ? item.displayName : "Calendar",
        color: typeof item.calendarColor === "string" ? item.calendarColor.slice(0, 7) : undefined,
        readOnly: false,
      }));
  },
  async listEvents(credentials, remote, from, to) {
    const { client, calendar } = await davCalendar(credentials, remote.remoteId);
    const objects = await client.fetchCalendarObjects({ calendar, timeRange: { start: from.toISOString(), end: to.toISOString() } });
    return objects.slice(0, 5000).flatMap((object) => {
      try {
        return typeof object.data === "string" ? parseEvents(object.data, object.url, object.etag, from, to) : [];
      } catch {
        return [];
      }
    });
  },
  async createEvent(credentials, remote, fields) {
    const { client, calendar } = await davCalendar(credentials, remote.remoteId);
    const uid = randomUUID();
    const filename = `${uid}.ics`;
    const response = await client.createCalendarObject({ calendar, filename, iCalString: buildEvent(uid, fields) });
    if (!response.ok) throw new UserFacingError(`The CalDAV server refused the new event (${response.status}).`);
    return { remoteId: new URL(filename, calendar.url).toString(), etag: response.headers.get("etag") ?? undefined };
  },
  async updateEvent(credentials, remote, remoteId, etag, fields) {
    const { client } = await davCalendar(credentials, remote.remoteId);
    const url = objectUrl(remoteId);
    const uid = decodeURIComponent(url.split("/").pop()!.replace(/\.ics$/, ""));
    const response = await client.updateCalendarObject({ calendarObject: { url, etag, data: buildEvent(uid, fields) } });
    if (!response.ok) throw new UserFacingError(`The CalDAV server refused the change (${response.status}).`);
    return { etag: response.headers.get("etag") ?? undefined };
  },
  async deleteEvent(credentials, remote, remoteId, etag) {
    const { client } = await davCalendar(credentials, remote.remoteId);
    const response = await client.deleteCalendarObject({ calendarObject: { url: objectUrl(remoteId), etag } });
    if (!response.ok && response.status !== 404) throw new UserFacingError(`The CalDAV server refused to delete the event (${response.status}).`);
  },
};

export function providerFor(provider: Provider): CalendarProvider {
  if (provider === "google") return google;
  if (provider === "microsoft") return microsoft;
  if (provider === "icloud" || provider === "caldav") return caldav;
  throw new UserFacingError("This calendar is not synced.");
}

export type OAuthProvider = "google" | "microsoft";

export function oauthConfig(provider: OAuthProvider) {
  const env = getEnv();
  if (provider === "google") {
    if (!env.googleClientId || !env.googleClientSecret) return undefined;
    return {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/calendar",
      extra: { access_type: "offline", prompt: "consent" } as Record<string, string>,
    };
  }
  if (!env.microsoftClientId || !env.microsoftClientSecret) return undefined;
  const tenant = encodeURIComponent(env.microsoftTenantId);
  return {
    clientId: env.microsoftClientId,
    clientSecret: env.microsoftClientSecret,
    authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scope: "offline_access Calendars.ReadWrite User.Read",
    extra: {} as Record<string, string>,
  };
}

export function redirectUri(provider: OAuthProvider): string {
  return `${getEnv().appUrl}/api/calendar/oauth/${provider}/callback`;
}

export async function exchangeCode(provider: OAuthProvider, code: string, verifier: string): Promise<OAuth> {
  const config = oauthConfig(provider);
  if (!config) throw new UserFacingError("This provider is not configured on this Holdall.");
  const data = await json<{ access_token: string; refresh_token?: string; expires_in: number }>(config.tokenUrl, {
    method: "POST",
    form: { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri(provider), client_id: config.clientId, client_secret: config.clientSecret },
  });
  if (!data.refresh_token) throw new UserFacingError("The provider did not allow offline access. Remove Holdall from your account permissions, then connect again.");
  return { kind: "oauth", accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

export async function freshCredentials(provider: Provider, credentials: Credentials): Promise<{ credentials: Credentials; changed: boolean }> {
  if (credentials.kind !== "oauth" || (provider !== "google" && provider !== "microsoft")) return { credentials, changed: false };
  if (credentials.expiresAt - 60000 > Date.now()) return { credentials, changed: false };
  const config = oauthConfig(provider);
  if (!config) throw new UserFacingError("This provider is not configured on this Holdall anymore.");
  const data = await json<{ access_token: string; refresh_token?: string; expires_in: number }>(config.tokenUrl, {
    method: "POST",
    form: { grant_type: "refresh_token", refresh_token: credentials.refreshToken, client_id: config.clientId, client_secret: config.clientSecret, ...(provider === "microsoft" ? { scope: config.scope } : {}) },
  });
  return {
    credentials: { kind: "oauth", accessToken: data.access_token, refreshToken: data.refresh_token ?? credentials.refreshToken, expiresAt: Date.now() + data.expires_in * 1000 },
    changed: true,
  };
}

export type { RemoteCalendar };
