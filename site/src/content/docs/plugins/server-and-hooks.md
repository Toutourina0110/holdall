---
title: Server code and hooks
description: Server code in its own Node process, the holdall object, and every hook with its payload.
---

Server code reacts to what happens in Holdall: a note saved, a task completed, an export asked for. It is an ES module named in `entry.server`, whose default export receives a `holdall` object:

```js
export default function setup(holdall) {
  holdall.on("tasks.completed", async ({ title }, context) => {
    await holdall.storage.set("last-done", title, context);
  });
}
```

## The `holdall` object

| Member | Use |
|---|---|
| `holdall.on(hook, handler)` | Listen to a hook. `handler(payload, context)` may be `async`. |
| `holdall.handle(name, handler)` | Expose a function your interface can call. See [Server functions](#server-functions). |
| `holdall.push(userId, event, data)` | Send a live event to that person's open widgets and pages. See [Live events](#live-events). |
| `holdall.api(method, params, context)` | Call any method of the [API reference](/holdall/plugins/api/). |
| `holdall.storage.get(key, context)` | Shortcut for `storage.get`. |
| `holdall.storage.set(key, value, context)` | Shortcut for `storage.set`. |
| `holdall.storage.delete(key, context)` | Shortcut for `storage.delete`. |
| `holdall.fetch(url, init, context)` | Shortcut for `network.fetch`. `init` is `{ method, headers, body }` or `undefined`. |
| `holdall.users()` | With `background`: the ids of everyone who turned your plugin on. |
| `holdall.as(userId)` | With `background`: a `context` to act for that person outside a hook. |
| `holdall.userDir(context)` | The private data folder of that person. See [Data folder](#data-folder). |
| `holdall.sharedDir()` | The data folder shared by everyone using the plugin. |
| `holdall.provide(name, handler)` | In a library: expose a function to plugins that depend on it. |
| `holdall.library(id).call(name, args, context)` | Call a function of a library listed in your `dependencies`. |
| `holdall.log(message)` | Write a line to the Holdall log, prefixed with your plugin id. |

`context` tells Holdall which person a call is for: `{ userId, callId }` in a hook, a server function or a library function, `{ userId }` from `holdall.as`. Pass it, unchanged, as the last argument of every call.

## When your code runs

- Holdall starts your process the first time one of your hooks or functions is needed, and keeps it running. With the `background` permission, it starts it as soon as Holdall starts, and starts it again if it crashes.
- Your default export runs once at start. Register your hooks and functions there.
- **Without `background`, API calls are only accepted while Holdall is calling one of your handlers**, with that call's `context`. This guarantees such a plugin only acts when something happens for a real person. With `background`, see [Background code](#background-code).
- Each handler has **5 seconds** to answer (15 seconds for `notes.export.render`). After that, Holdall stops waiting and logs it.
- If your process crashes, Holdall starts it again at the next hook or call.
- Installing a new version stops the old process; the next hook starts the new one.

## The sandbox

By default the process is started with the Node permission model:

- it can read the files of your plugin folder, read and write its [data folder](#data-folder) (with `storage`), and nothing else;
- it cannot write other files, start programs, open network connections or load native addons;
- it can run WebAssembly, but not WASI or worker threads;
- it has 512 MB of memory.

Everything else goes through `holdall` calls, checked against your permissions. Use `holdall.fetch` instead of `fetch`, and your data folder, storage or `files.write` for files.

Need more? The [dangerous permissions](/holdall/plugins/permissions/#dangerous-permissions) open the sandbox step by step: `network:direct` for your own network connections, `fs:host` for any file, `process:spawn` to start programs, `system` for no sandbox at all.

:::note
The Node permission model blocks what ordinary code can do. It is not a full security boundary against someone who finds a bug in Node itself, which is why admins review every plugin before installing it.
:::

## Hooks

List every hook you use in `contributes.hooks`, and add its `hooks:<name>` permission and the permission of its data.

| Hook | Kind | Needs | When |
|---|---|---|---|
| `notes.saved` | action | `notes:read` | A note was saved |
| `notes.deleted` | action | `notes:read` | A note was moved to the trash |
| `tasks.completed` | action | `tasks:read` | A task was marked as done |
| `download.finished` | action | `downloads:read` | A download finished |
| `notes.export.formats` | filter | `notes:read` | Holdall shows the export buttons of a note |
| `notes.export.render` | filter | `notes:read` | Someone exports a note in one of your formats |
| `calendar.event.render` | filter | `calendar:read` | The calendar loads events to show |
| `dashboard.widgets` | filter | `ui:slots` | Holdall builds the Today page |

## Actions

An action tells you something happened. Your return value is ignored; errors are logged and never shown to the person.

| Hook | Payload |
|---|---|
| `notes.saved` | `{ id, title }` |
| `notes.deleted` | `{ id }` |
| `tasks.completed` | `{ id, title }` |
| `download.finished` | `{ id, file, title }`, with `file` the path in the **Downloads** folder |

Example: save every finished download's title in a list.

```js
holdall.on("download.finished", async ({ title }, context) => {
  const list = (await holdall.storage.get("titles", context)) ?? [];
  await holdall.storage.set("titles", [title, ...list].slice(0, 50), context);
});
```

## Filters

A filter receives a value and returns it, changed. Holdall checks your answer: if it is not valid, it is ignored and Holdall keeps the value it had, so a broken plugin never breaks a page. When several plugins use the same filter, they run one after the other.

### `notes.export.formats` and `notes.export.render`

Add your own export formats to notes. They appear as buttons next to **Export** on each note.

`notes.export.formats` receives a list and returns it with your formats added. Each format is `{ id, label, extension }`: `id` in lower case letters, digits and dashes, `label` up to 40 characters, `extension` without the dot. Up to 5 formats per plugin.

`notes.export.render` receives `{ format, note: { id, title, content } }` and returns `{ content }`: the text of the file, up to 5 MB. Holdall sends it as `<note title>.<extension>`.

```js
holdall.on("notes.export.formats", (formats) => [...formats, { id: "plain", label: "Plain text", extension: "txt" }]);

holdall.on("notes.export.render", ({ format, note }) => {
  if (format !== "plain") return { content: note.content };
  return { content: note.content.replace(/[#*_`>]/g, "") };
});
```

Needs `notes:read`, `hooks:notes.export.formats` and `hooks:notes.export.render`.

### `calendar.event.render`

Change how events look in the calendar. Receives the list of events being shown, `[{ id, title, color }]`, and returns the same list, in the same order, with titles (up to 200 characters) or colors (`#rrggbb`) changed.

```js
holdall.on("calendar.event.render", (events) =>
  events.map((event) => (/standup/i.test(event.title) ? { ...event, color: "#2f6b3f" } : event)),
);
```

The change is for display only: when the person opens the event, they see and edit its real title.

### `dashboard.widgets`

Choose which widgets appear on **Today**. Receives `[{ id, label }]` for every widget, and returns the ones to keep. You can hide widgets, but not add new ones: declare your own widgets in the manifest instead.

```js
holdall.on("dashboard.widgets", (widgets) => {
  const weekend = [0, 6].includes(new Date().getDay());
  return weekend ? widgets.filter((widget) => widget.id !== "tasks.today") : widgets;
});
```

## Background code

With the `background` permission, your server code can work on its own: on a timer, when a WebSocket receives a message, at start.

```js
export default function setup(holdall) {
  setInterval(async () => {
    for (const userId of await holdall.users()) {
      const context = holdall.as(userId);
      const response = await holdall.fetch("https://api.example.com/feed", undefined, context);
      await holdall.storage.set("feed", JSON.parse(response.body), context);
      holdall.push(userId, "feed", { updated: Date.now() });
    }
  }, 15 * 60 * 1000);
}
```

- `holdall.users()` returns the ids of the people who turned the plugin on, right now.
- `holdall.as(userId)` gives a `context` for one of them. Calls with it are checked like any other: the person must have the plugin turned on, and the plugin needs the permission of each method.
- Holdall starts background plugins when it starts, when someone turns them on, and after an update. If the process crashes, it starts it again after 5 seconds, then waits longer each time, up to 5 minutes.
- When nobody has the plugin turned on anymore, Holdall stops it.

## Data folder

Every plugin with server code and the `storage` permission gets its own folder on disk, where it can read and write anything with `fs`: SQLite files, caches, downloads, logs.

```js
import fs from "node:fs";
import path from "node:path";

holdall.handle("save", ({ text }, context) => {
  fs.writeFileSync(path.join(holdall.userDir(context), "draft.md"), text);
});
```

| Folder | For |
|---|---|
| `holdall.userDir(context)` | One person's data. Created on first use. |
| `holdall.sharedDir()` | Data for everyone: caches, downloaded models, shared state. |

- The folders live in the Holdall data folder, under `plugin-data/<plugin id>/`, so they are part of every backup.
- A person's folder is deleted with their account. The whole plugin folder is deleted when the plugin is uninstalled, and kept on updates.
- Your code can technically read every person's folder of your plugin: always use the `context` of the call, and never show one person's data to another.
- Use storage for small values the interface reads directly, and the data folder for files and bigger data.

## Libraries

A library is a plugin with `"type": "library"` and server code that other plugins can call. Use it to share one API client, one cache or one login between several plugins.

In the library:

```js
export default function setup(holdall) {
  holdall.provide("search", async ({ query }, context) => {
    const settings = await holdall.api("settings.get", undefined, context);
    const response = await holdall.fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}&key=${settings.apiKey}`, undefined, context);
    return JSON.parse(response.body);
  });
}
```

In a plugin that uses it, declare it in the manifest:

```json
"dependencies": { "com.example.search-client": ">=1.0.0" }
```

Then call it:

```js
holdall.handle("find", ({ query }, context) => holdall.library("com.example.search-client").call("search", { query }, context));
```

- Only libraries listed in your `dependencies` can be called, and only if the installed plugin really has `"type": "library"` and a version that matches your range. Holdall installs nothing for you: the admin installs the library first, and cannot uninstall it while a plugin needs it.
- Pass your `context` to call it for the same person. The library then works for that person with **its own** permissions and its own storage. Without `context`, the library runs with no person and cannot use person data.
- A library is active for everyone who turned on a plugin that depends on it. It does not appear in **On your account**.
- Each library and each plugin runs in its own process: a library cannot see the plugin's data, and the plugin cannot use the library's permissions.
- Calls are limited to 30 seconds.

## Server functions

Your interface can call functions of your server code. Use them for anything the browser should not do: secret API keys, sites without CORS, heavy work.

```js
holdall.handle("weather", async ({ city }, context) => {
  const response = await holdall.fetch(`https://api.example.com/weather?city=${encodeURIComponent(city)}&key=SECRET`, undefined, context);
  return JSON.parse(response.body);
});
```

From the interface:

```js
const weather = await holdall("server.call", { name: "weather", args: { city: "Lisbon" } });
```

- `name`: letters, digits and `_ . : -`, up to 80 characters.
- The handler receives the arguments and a `context` for the person who called it, so every API call inside works as in a hook.
- Return anything JSON can hold. A thrown error comes back to the interface with its message.
- Arguments are limited to 1 MB; the handler has 30 seconds.

## Live events

`holdall.push(userId, event, data)` sends an event to every widget and page of your plugin that this person has open, as soon as it happens:

```js
holdall.handle("start", async (_args, context) => {
  for (let step = 1; step <= 3; step++) {
    holdall.push(context.userId, "progress", { step });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return "done";
});
```

- Holdall only delivers to people who turned your plugin on; events for anyone else are dropped.
- `data` is limited to 64 KB once encoded.
- Nothing is stored: a person who has no page open does not get the event later. Keep state in storage if it matters.

The interface receives them as described in [Receive live events](/holdall/plugins/interface/#receive-live-events).

## Logs

`holdall.log("message")`, `console.log` and errors your code throws all end up in the Holdall log, prefixed with your plugin id. See [Read the logs](/holdall/plugins/tooling/#read-the-logs).
