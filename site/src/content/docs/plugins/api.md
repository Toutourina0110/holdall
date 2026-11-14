---
title: API reference
description: Every method a plugin can call, with its permission, parameters, result and limits.
---

The same methods are available from interface code and from server code:

```js
await holdall("notes.list", { query: "trip" });
await holdall.api("notes.list", { query: "trip" }, context);
```

The first line is interface code ([Interface code](/holdall/plugins/interface/)); the second is server code, inside a hook, a server function or background code ([Server code and hooks](/holdall/plugins/server-and-hooks/)).

Every call:

- runs for one person: the one looking at the page, or the one of the `context` your server code passes;
- fails if the plugin is turned off for that person, or lacks the permission;
- checks its parameters, and fails with *Invalid parameters for `<method>`* if they are wrong.

Dates are ISO 8601 strings (`2026-11-11` or `2026-11-11T14:30:00.000Z`).

## Theme

### `theme.tokens`

Interface code only. No permission.

**Returns** an object of CSS variables, for example `{ "--color-surface": "#ffffff", ... }`. See [Match the theme](/holdall/plugins/interface/#match-the-theme).

## Your server code

Interface code only. No permission; needs `entry.server`.

### `server.call`

**Params** `{ name, args? }`. Calls the function your server code registered with `holdall.handle(name, ...)`. **Returns** what it returns. See [Server functions](/holdall/plugins/server-and-hooks/#server-functions).

### `events.subscribe`

No params. **Returns** `true`. From then on, events your server code sends with `holdall.push` arrive as `{ type: "holdall:event", event, data }` messages. See [Receive live events](/holdall/plugins/interface/#receive-live-events).

## Page address

Interface code of a page only. No permission. See [Pages and addresses](/holdall/plugins/interface/#pages-and-addresses).

### `page.path`

No params. **Returns** the current path under `/p/<plugin id>/`, `""` on the main page, or `null` in a widget.

### `page.navigate`

**Params** `{ path }`. Changes the address to `/p/<plugin id>/<path>` without reloading the page. **Returns** `true`.

## Settings

### `settings.get`

No permission. No params. **Returns** the values of your [settings](/holdall/plugins/manifest/#settings) for the person: their personal values, the global values, and defaults for anything not saved.

```json
{ "apiKey": "abc123", "city": "Lisbon", "units": "c", "days": 3, "alerts": false }
```

From interface code, `secret` values are `true` (set) or `null` (not set). From server code they are the real value. Read settings when you need them: people can change them at any time.

## Storage

Private data for your plugin, separate for each person, shared between your interface and server code. Deleted when the plugin is uninstalled.

### `storage.get`

Permission `storage`. **Params** `{ key }`. **Returns** the stored value, or `null`.

### `storage.set`

Permission `storage`. **Params** `{ key, value }`. **Returns** `true`.

- `key`: 1 to 100 characters among letters, digits and `_ . : -`.
- `value`: anything JSON can hold, up to 256 KB once encoded.

### `storage.delete`

Permission `storage`. **Params** `{ key }`. **Returns** `true`.

## Network

### `network.fetch`

Permission `network`, `network:any` or `network:local`. **Params** `{ url, method?, headers?, body? }`.

- `url`: with `network`, an `https` address whose host is listed in the manifest's `network`. With `network:any`, any public `http` or `https` address. With `network:local`, private addresses too.
- `method`: `GET` (default), `POST`, `PUT`, `PATCH` or `DELETE`.
- `headers`: an object of strings. `Cookie` and `Host` are removed.
- `body`: a string, up to 1 MB.

**Returns** `{ status, headers, body }`, with `body` as text. With `network`, answers are limited to 2 MB and 15 seconds, redirects are not followed, and private addresses are refused even if a host name points to one. With `network:any` or `network:local`, answers can be 20 MB and 60 seconds, and up to 5 redirects are followed.

## Notes

### `notes.list`

Permission `notes:read`. **Params** `{ query? }`. **Returns** up to 200 summaries, pinned notes first, then the most recently changed:

```json
[{ "id": "...", "title": "Weekly review", "folder": "Planning", "tags": ["work"], "updatedAt": "2026-11-11T09:12:00.000Z" }]
```

With `query`, searches titles and text.

### `notes.get`

Permission `notes:read`. **Params** `{ id }`. **Returns** a summary plus `content` (the Markdown), or `null` if the note is in the trash.

### `notes.create`

Permission `notes:write`. **Params** `{ title, folder?, content? }`. `folder` uses `/` for subfolders. **Returns** the new summary.

### `notes.update`

Permission `notes:write`. **Params** `{ id, title?, content? }`. **Returns** the summary. Holdall keeps the previous text in the note's history.

### `notes.trash`, `notes.restore`

Permission `notes:write`. **Params** `{ id }`. Move a note to the trash, or bring it back. **Returns** `true`, or the restored summary.

### `notes.move`

Permission `notes:write`. **Params** `{ id, folder }`, with `/` for subfolders and `""` for the top. **Returns** the summary.

### `notes.setTags`

Permission `notes:write`. **Params** `{ id, tags }`. Replaces the tags. **Returns** the tags as saved.

### `notes.setFlags`

Permission `notes:write`. **Params** `{ id, pinned?, favorite? }`. **Returns** `true`.

## Tasks

### `tasks.list`

Permission `tasks:read`. **Params** `{ view?, today }`.

- `view`: `inbox`, `today` (default), `upcoming` or `done`.
- `today`: the person's date, `YYYY-MM-DD`. Pass it from the interface (`new Date().toISOString().slice(0, 10)` or a local date), so "today" matches their time zone.

**Returns** tasks: `{ id, title, description, dueDate, dueTime, priority, labels, listId, parentId, completedAt, ... }`. `completedAt` is the date the task was done, or `null`.

### `tasks.create`

Permission `tasks:write`. **Params** `{ title, description?, dueDate?, dueTime?, priority?, labels?, listId?, parentId? }`.

- `dueDate` `YYYY-MM-DD`, `dueTime` `HH:MM`;
- `priority` 0 (none) to 3 (high);
- `labels` up to 10 short words.

**Returns** the new task.

### `tasks.complete`

Permission `tasks:write`. **Params** `{ id, done }`. **Returns** the task.

### `tasks.update`

Permission `tasks:write`. **Params** `{ id }` plus any field of `tasks.create`. Fields you leave out keep their value. **Returns** the task.

### `tasks.delete`

Permission `tasks:write`. **Params** `{ id }`. Deletes the task and its subtasks. **Returns** `true`.

### `tasks.lists`

Permission `tasks:read`. No params. **Returns** the person's lists, `[{ id, name, ... }]`.

### `tasks.createList`, `tasks.renameList`, `tasks.deleteList`

Permission `tasks:write`. **Params** `{ name }`, `{ id, name }` and `{ id }`. Deleting a list deletes its tasks. **Returns** the new list, or `true`.

## Calendar

### `calendar.list`

Permission `calendar:read`. **Params** `{ from, to }`. **Returns** events in that period, from every calendar the person shows:

```json
[{ "id": "...", "title": "Dentist", "start": "...", "end": "...", "allDay": false, "location": "" }]
```

### `calendar.create`

Permission `calendar:write`. **Params** `{ title, start, end, allDay?, location?, description? }`. The event goes to the person's Holdall calendar. **Returns** `{ id }`.

### `calendar.update`

Permission `calendar:write`. **Params** `{ id, title?, start?, end?, allDay?, location?, description? }`. Fields you leave out keep their value. Changes to synced events are sent to their service at the next sync. Repeating events and read-only calendars are refused. **Returns** the event.

### `calendar.delete`

Permission `calendar:write`. **Params** `{ id }`. Same rules as `calendar.update`. **Returns** `true`.

## Files

Paths are relative to the person's main folder, with `/` between folders, like `Reports/2026/summary.txt`. `..` and names starting with a dot are refused.

### `files.list`

Permission `files:read`. **Params** `{ root?, path? }`.

- `root`: `files` (default, **My files**) or `downloads`.
- `path`: the folder, `""` for the top.

**Returns** entries, folders first:

```json
[{ "name": "summary.txt", "path": "Reports/summary.txt", "kind": "file", "size": 1204, "modified": "...", "type": "text" }]
```

`type` is `folder`, `image`, `video`, `audio`, `pdf`, `text` or `other`.

### `files.read`

Permission `files:read`. **Params** `{ root?, path, encoding? }`. `encoding` is `utf8` (default) or `base64` for binary files. **Returns** `{ content, size }`. Files over 16 MB, or over the upload limit of the server (`MAX_UPLOAD_MB`) if it is lower, are refused. For bigger files, use your [data folder](/holdall/plugins/server-and-hooks/#data-folder) from server code.

### `files.write`

Permission `files:write`. **Params** `{ path, content, encoding?, overwrite? }`.

- Writes in **My files** only. Missing folders are created.
- `encoding`: `utf8` (default) or `base64`.
- `overwrite`: `false` (default) adds ` (2)`, ` (3)`... to the name if a file exists; `true` replaces it.
- Up to 16 MB, or the upload limit of the server (`MAX_UPLOAD_MB`) if it is lower.

**Returns** `{ path, size }` with the path actually used.

### `files.mkdir`

Permission `files:write`. **Params** `{ path }`, the folder to create in **My files**. **Returns** `{ path }`.

### `files.rename`

Permission `files:write`. **Params** `{ path, name }`. Renames a file or folder in **My files**. **Returns** `{ path }` with the new path.

### `files.move`

Permission `files:write`. **Params** `{ path, to }`, `to` being a folder (`""` for the top). **Returns** `{ path }` with the new path.

### `files.delete`

Permission `files:write`. **Params** `{ path }`. Deletes a file or a folder with everything in it, in **My files** only. **Returns** `true`.

## Downloads

### `downloads.list`

Permission `downloads:read`. No params. **Returns** `{ id, status, progress, result }` for each download. `status` is `queued`, `running`, `done`, `failed` or `cancelled`.

### `downloads.create`

Permission `downloads:create`. **Params** `{ url, title?, options? }`.

- `url`: a public `http` or `https` link to a video, playlist or channel.
- `options`: `{ kind: "video" | "audio", container?: "mp4" | "webm" | "mkv", quality?: "best" | "2160" | "1440" | "1080" | "720" | "480" | "360", audioFormat?: "mp3" | "m4a" | "opus" }`. Default `{ kind: "video" }`.

**Returns** `{ id }`. The download joins the person's queue; listen to `download.finished` to know when it is done. Refused on demo instances.

## Notifications

### `notifications.show`

Permission `notifications`. **Params** `{ title, body? }`: `title` 1 to 120 characters, `body` up to 500. **Returns** `true`.

The notification appears under the bell in the top bar, with your plugin's name. Each plugin can send 30 per person per hour; Holdall keeps the last 100 per person.
