---
title: Interface code
description: Widgets and pages in a sandboxed iframe, how they talk to Holdall, and how to match the theme.
---

Widgets and pages are HTML files from your archive, shown in an iframe with `sandbox="allow-scripts"` and no same origin.

## What the sandbox allows

| Allowed | Not allowed |
|---|---|
| Running your inline scripts and styles | Reading the Holdall session, cookies or page |
| Calling Holdall through `postMessage` | Loading other files from Holdall (requests carry no session) |
| Drawing anything inside your frame | Opening pop-ups, submitting forms to other sites, top navigation |

So: **keep each HTML file self-contained.** Inline your scripts and styles, or bundle them into the file (see [Tooling](/holdall/plugins/tooling/#bundle-your-interface)). Images can be inline SVG or `data:` URLs.

To reach the internet, ask Holdall: call `network.fetch` (with the `network` permission) instead of `fetch()`.

## Talk to Holdall

Send a request with `parent.postMessage` and wait for the answer with the same `id`:

| Direction | Message |
|---|---|
| Plugin to Holdall | `{ type: "holdall:request", id, method, params }` |
| Holdall to plugin, success | `{ type: "holdall:response", id, result }` |
| Holdall to plugin, failure | `{ type: "holdall:response", id, error }` (a sentence you can show) |

A minimal client:

```js
let next = 0;
const waiting = new Map();
addEventListener("message", (event) => {
  const data = event.data;
  if (event.source !== parent || !data || data.type !== "holdall:response") return;
  const call = waiting.get(data.id);
  if (!call) return;
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

Always check `event.source === parent`: other frames could send you messages too. The [SDK's `createClient()`](/holdall/plugins/tooling/#the-sdk) does all of this, with types and a 15 second timeout.

Every method of the [API reference](/holdall/plugins/api/) is available, with the person looking at the page as the user.

## Match the theme

`theme.tokens` returns the person's current theme as CSS variables. Apply them, then use them in your CSS:

```js
const tokens = await holdall("theme.tokens");
for (const [name, value] of Object.entries(tokens)) document.documentElement.style.setProperty(name, value);
```

```css
body { background: var(--color-surface); color: var(--color-text); }
```

Tokens you receive:

| Group | Tokens |
|---|---|
| Backgrounds | `--color-ground`, `--color-surface`, `--color-raised` |
| Text | `--color-ink` (headings), `--color-text`, `--color-muted` |
| Lines | `--color-line`, `--color-line-strong` |
| Accent | `--color-accent`, `--color-accent-fill`, `--color-accent-soft`, `--color-accent-text`, `--color-on-accent` |
| Status | `--color-done`, `--color-late`, `--color-warn` |
| Shapes | `--radius-control`, `--radius-panel` |
| Spacing | `--space-2`, `--space-3`, `--space-4` |
| Text sizes | `--text-ui`, `--text-sm` |

The theme is read when your frame loads. Holdall's font is IBM Plex Sans; use `font-family: "IBM Plex Sans", sans-serif` and it falls back cleanly when the font is not available.

## Sizes

- **Widgets** are at least 220 px tall and 1, 2 or 3 grid columns wide (`width` in the manifest). On a phone they take the full width.
- **Pages** fill the content area, below Holdall's own title and your plugin description.

Design for 375 px wide first: many people open Holdall on a phone.

## Show errors

Calls can fail: a permission was refused, the network is down, the person turned the plugin off. Catch every call and show the error message in your frame; Holdall's messages are written to be shown as they are.
