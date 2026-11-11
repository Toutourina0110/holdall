---
title: Server code and hooks
description: Server code in its own Node process, and the hooks it can listen to.
---

`entry.server` is an ES module whose default export receives a `holdall` object:

```js
export default function (holdall) {
  holdall.on("notes.saved", async (payload, context) => {
    const count = ((await holdall.storage.get("saves", context)) ?? 0) + 1;
    await holdall.storage.set("saves", count, context);
  });
}
```

## Sandbox

Server code runs in its own Node process, started with the Node permission model:

- it can read its own folder only;
- it cannot write files, start programs, open network connections or load native addons;
- it is limited to 128 MB of memory.

Everything goes through `holdall` calls, checked against the granted permissions. API calls are only accepted while Holdall is calling one of your hooks, and always act for the person of that call: pass `context` as the last argument.

:::note
The Node permission model limits what ordinary code can do. It is not a full security boundary against a determined attacker who finds a bug in Node itself. Admins should only install plugins they trust.
:::

## Hooks

| Hook | Kind | Payload | Permission |
|---|---|---|---|
| `notes.saved` | action | `{ id, title }` | `notes:read` |
| `notes.deleted` | action | `{ id }` | `notes:read` |
| `notes.export.formats` | filter | list of formats | `notes:read` |
| `tasks.completed` | action | `{ id, title }` | `tasks:read` |
| `download.finished` | action | `{ id, file, title }` | `downloads:read` |
| `calendar.event.render` | filter | event | `calendar:read` |
| `dashboard.widgets` | filter | widget list | `ui:slots` |

An **action** is a notification; its return value is ignored. A **filter** receives a value and returns the changed value; an invalid answer is ignored. Each call times out after 5 seconds.

List each hook in `contributes.hooks` and add the matching `hooks:<name>` permission.
