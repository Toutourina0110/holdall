---
title: Interface code
description: Pages and widgets in a sandboxed iframe, and the methods they can call.
---

Pages and widgets are HTML files shown in a sandboxed iframe (`sandbox="allow-scripts"`, no same origin). They cannot read cookies, the session or the Holdall page.

Keep each file self-contained: inline its scripts and styles, because requests made from inside the sandbox carry no session and cannot load other files from Holdall.

## Talk to Holdall

Use `postMessage`. The [SDK](/holdall/plugins/sdk/) wraps this for you; without it:

```js
let next = 0;
const waiting = new Map();
addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type !== "holdall:response") return;
  const call = waiting.get(data.id);
  waiting.delete(data.id);
  data.error ? call.reject(new Error(data.error)) : call.resolve(data.result);
});
function holdall(method, params) {
  const id = ++next;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    parent.postMessage({ type: "holdall:request", id, method, params }, "*");
  });
}
```

## Methods

| Method | Permission | Parameters | Returns |
|---|---|---|---|
| `theme.tokens` | none | none | The current theme colors and sizes, as CSS variables |
| `storage.get` | `storage` | `{ key }` | The stored value or `null` |
| `storage.set` | `storage` | `{ key, value }` | `true` (256 KB per value) |
| `storage.delete` | `storage` | `{ key }` | `true` |
| `network.fetch` | `network` | `{ url, method, headers, body }` | `{ status, headers, body }` (2 MB, https, listed hosts, no private addresses) |
| `notes.list` | `notes:read` | `{ query? }` | Note summaries |
| `notes.get` | `notes:read` | `{ id }` | A note with its Markdown |
| `notes.create` | `notes:write` | `{ title, folder?, content? }` | The new note summary |
| `notes.update` | `notes:write` | `{ id, title?, content? }` | The note summary |
| `tasks.list` | `tasks:read` | `{ view, today }` | Tasks |
| `tasks.create` | `tasks:write` | task fields | The new task |
| `tasks.complete` | `tasks:write` | `{ id, done }` | The task |
| `downloads.list` | `downloads:read` | none | Downloads and their status |
| `calendar.list` | `calendar:read` | `{ from, to }` (ISO dates) | Events in that period |
| `calendar.create` | `calendar:write` | `{ title, start, end, allDay?, location?, description? }` | `{ id }` of the event, added to the Holdall calendar |

Calls run as the person looking at the page and only reach that person's data.

## Match the theme

Call `theme.tokens` and set the returned CSS variables on your document, so your page follows the person's light, dark or custom theme. The SDK's `applyTheme` does it in one line.
