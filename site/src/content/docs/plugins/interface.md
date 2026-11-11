---
title: Interface code
description: Widgets and pages in a sandboxed iframe, how they talk to Holdall, and how to match the theme.
---

Widgets and pages are HTML files from your archive, shown in a sandboxed iframe. Inside it you are free; the only thing you never get is the Holdall session.

## What your interface can do

| Allowed | Not allowed |
|---|---|
| Load other files from your archive: scripts, styles, images, fonts, sounds, videos, WebAssembly | Read the Holdall session, cookies or page |
| Load anything from any website: libraries from a CDN, images, videos, fonts | Navigate the Holdall tab away |
| Call any web API with `fetch()`, `WebSocket` or `EventSource` (the site must allow it with CORS) | Send requests to Holdall as the person (they are refused) |
| Embed other sites in frames, for example a video or stream player | |
| Open links in a new tab, go fullscreen, play media, offer downloads, submit forms, copy to the clipboard | |
| Call Holdall and your own server code through `postMessage` | |

Files of your archive are served from the same folder as your HTML file, so relative paths just work:

```html
<link rel="stylesheet" href="style.css">
<script type="module" src="app.js"></script>
<img src="images/logo.png" alt="">
```

Supported file types: `.html`, `.js`, `.mjs`, `.css`, `.json`, `.map`, `.txt`, `.svg`, `.png`, `.jpg`, `.gif`, `.webp`, `.avif`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.mp3`, `.ogg`, `.wav`, `.mp4`, `.webm`, `.wasm`. The links include a signed key valid for 12 hours, for the person viewing the plugin; reload the page if it stays open longer.

### `fetch()` or `network.fetch`?

| | `fetch()` from the interface | `network.fetch` or your server code |
|---|---|---|
| Runs in | The person's browser | The Holdall server |
| Needs | The site to allow CORS | The `network` permission and the host in `network` |
| Good for | Public APIs, CDNs, embeds | Secret API keys, sites without CORS |

Never put a secret API key in interface code: anyone using the plugin can read it. Keep it in your server code and call that code with `server.call` (see [Call your server code](#call-your-server-code)).

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

## Call your server code

Your interface can call functions of your own [server code](/holdall/plugins/server-and-hooks/#server-functions):

```js
const greeting = await holdall("server.call", { name: "greet", args: { name: "Ada" } });
```

The function runs for the person looking at the page. An error it throws comes back as the error of the call. Arguments are limited to 1 MB, and the function has 30 seconds to answer.

## Receive live events

Your server code can push events to the interface at any time, for example new chat messages or progress. Subscribe once, then listen:

```js
addEventListener("message", (event) => {
  const data = event.data;
  if (event.source !== parent || !data || data.type !== "holdall:event") return;
  if (data.event === "message") showMessage(data.data);
});
await holdall("events.subscribe");
```

Every open widget and page of your plugin receives the events sent to the person looking at it. With the SDK: `onEvent(holdall, (event, data) => { ... })`.

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
