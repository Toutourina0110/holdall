---
title: "Tutorial: your first plugin"
description: Build, install and update a word count plugin with a widget, a page, server code and a notification.
---

You will build **Word count**: it counts the words in the notes you edit each day, shows the total in a widget on **Today**, lists past days on its own page, and sends a notification when you pass 500 words.

The finished plugin is in the Holdall repository, in `examples/plugins/word-count`. Holdall's own tests install and run it, so it always works with the current version.

**You need:** a Holdall where you are admin (a local one is fine, see [Development](/holdall/contributing/development/)), Node 26, and a copy of the Holdall repository for the packing script.

## 1. Create the folder

```
word-count/
  holdall.plugin.json
  server.mjs
  ui/
    widget.html
    page.html
```

Each part has one job:

| File | Runs | Job |
|---|---|---|
| `holdall.plugin.json` | At install | Says who you are and what you need |
| `server.mjs` | In its own Node process | Counts words each time a note is saved |
| `ui/widget.html` | In a sandboxed iframe on Today | Shows today's total |
| `ui/page.html` | In a sandboxed iframe, on its own page | Lists the last days |

## 2. Write the manifest

```json
{
  "id": "com.example.word-count",
  "name": "Word count",
  "version": "1.0.0",
  "type": "extension",
  "description": "Counts the words in the notes you edit each day.",
  "author": { "name": "Your name", "url": "https://github.com/you" },
  "license": "MIT",
  "holdall": ">=0.0.1",
  "permissions": ["ui:slots", "storage", "notes:read", "hooks:notes.saved"],
  "optionalPermissions": ["notifications"],
  "entry": { "server": "server.mjs", "ui": "ui/page.html" },
  "contributes": {
    "hooks": ["notes.saved"],
    "widgets": [{ "id": "today", "title": "Words today", "entry": "ui/widget.html", "width": 1 }],
    "page": { "title": "Word count", "entry": "ui/page.html" }
  }
}
```

What each permission is for:

- `ui:slots` shows the widget and the page;
- `storage` keeps the daily counts;
- `notes:read` and `hooks:notes.saved` let the server code hear about saved notes and read them;
- `notifications` is **optional**: the admin can refuse it and the plugin still works, just without the notification.

Use your own reverse domain name for `id` (for example `io.github.yourname.word-count`). It never changes, even when you rename the plugin.

## 3. Write the server code

`server.mjs` is an ES module. Its default export receives the `holdall` object:

```js
const goal = 500;

function countWords(markdown) {
  const text = markdown.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`[\]()|-]/g, " ");
  return text.split(/\s+/).filter(Boolean).length;
}

export default function setup(holdall) {
  holdall.on("notes.saved", async ({ id }, context) => {
    const note = await holdall.api("notes.get", { id }, context);
    if (!note) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `day:${today}`;
    const day = (await holdall.storage.get(key, context)) ?? { notes: {}, notified: false };
    day.notes[id] = countWords(note.content);
    const total = Object.values(day.notes).reduce((sum, words) => sum + words, 0);
    if (total >= goal && !day.notified) {
      day.notified = true;
      try {
        await holdall.api("notifications.show", { title: `You wrote ${total} words today`, body: `Your goal was ${goal} words.` }, context);
      } catch (error) {
        holdall.log(`No notification sent: ${error.message}`);
      }
    }
    await holdall.storage.set(key, day, context);
    const days = (await holdall.storage.get("days", context)) ?? [];
    if (!days.includes(today)) await holdall.storage.set("days", [today, ...days].slice(0, 30), context);
  });
}
```

Three rules to remember:

1. **Always pass `context`** as the last argument of every call. It says which person the call is for. Calls without it are refused.
2. **Calls work inside a hook or a server function.** To work on a timer, ask for the `background` permission (see [Background code](/holdall/plugins/server-and-hooks/#background-code)).
3. **Each person has their own storage.** The same key holds different values for different people.

The `try` around `notifications.show` matters: if the admin refused the optional permission, the call fails with a clear error, and the plugin keeps working.

## 4. Write the widget

`ui/widget.html` is a complete HTML file. Everything is inline here to keep the tutorial in one file; a real plugin can also load `style.css`, `app.js` or images from its archive.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 16px; font-family: "IBM Plex Sans", sans-serif; font-size: 14px; background: var(--color-surface, #fff); color: var(--color-text, #1b2833); }
  strong { display: block; font-size: 26px; color: var(--color-ink, #14202a); font-variant-numeric: tabular-nums; }
  p { margin: 4px 0 12px; color: var(--color-muted, #55616b); }
  .bar { height: 6px; border-radius: 3px; background: var(--color-line, #d5dde3); overflow: hidden; }
  .fill { height: 100%; width: 0; background: var(--color-accent-fill, #1f4a7a); }
</style>
</head>
<body>
<strong id="total">...</strong>
<p id="label">words in the notes you edited today</p>
<div class="bar"><div class="fill" id="fill"></div></div>
<script>
  const goal = 500;
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
  (async () => {
    const tokens = await holdall("theme.tokens");
    for (const [name, value] of Object.entries(tokens)) document.documentElement.style.setProperty(name, value);
    const today = new Date().toISOString().slice(0, 10);
    const day = await holdall("storage.get", { key: "day:" + today });
    const total = day ? Object.values(day.notes).reduce((sum, words) => sum + words, 0) : 0;
    document.getElementById("total").textContent = total.toLocaleString("en-GB");
    document.getElementById("fill").style.width = Math.min(100, Math.round((total / goal) * 100)) + "%";
  })().catch((error) => {
    document.getElementById("total").textContent = "!";
    document.getElementById("label").textContent = error.message;
  });
</script>
</body>
</html>
```

What happens here:

- The small `holdall()` function sends a request to Holdall with `postMessage` and waits for the answer. The [SDK](/holdall/plugins/tooling/#the-sdk) gives you the same thing, typed.
- `theme.tokens` returns the person's current colors and sizes. Setting them as CSS variables makes the widget follow light, dark and custom themes. The values after the commas in `var()` are only used if that call fails.
- The widget reads the same storage key the server code writes. Storage is shared between your server code and your interface code, for the same person.

## 5. Write the page

`ui/page.html` follows the same pattern and lists the days saved under the `days` key. Copy it from `examples/plugins/word-count/ui/page.html`. It builds rows with `textContent`, never `innerHTML`: note titles and other data can contain anything.

## 6. Pack and install

From the root of the Holdall repository, in PowerShell:

```powershell
node scripts/pack-plugin.mjs path\to\word-count
```

It writes `dist-plugins\com.example.word-count-1.0.0.zip` and prints its sha256 checksum.

In Holdall:

1. Open **Plugins**. Under **Install a plugin**, choose the archive, then **Review the plugin**.
2. Check the permissions. Leave **Show you notifications** checked, then **Accept and install**.
3. Under **On your account**, turn **Word count** on.
4. Open **Today**: the **Words today** widget is there. Use **Customize** to move it.
5. Open **Word count** in the side bar to see the page.

## 7. Try it

Open a note and write a few lines. Wait a second for it to save, then open **Today**: the total has changed. Paste a long text to pass 500 words: the bell in the top bar shows **1**.

Nothing happens? Read [Tooling and debugging](/holdall/plugins/tooling/#when-something-does-not-work).

## 8. Change it

Edit your files, pack again and install again, with the same version or a new one. Holdall replaces the old files, restarts the server code and keeps the plugin's storage. When the new version asks for more permissions, they are shown as **New** on the review screen.

Bump `version` before you share a new release, so admins see **Update to x.y.z** in the store.

## Next steps

- Look at every method in the [API reference](/holdall/plugins/api/).
- Add an export format with [filter hooks](/holdall/plugins/server-and-hooks/#filters).
- Write it in TypeScript with the [SDK and a bundler](/holdall/plugins/tooling/).
- [Publish it](/holdall/plugins/publishing/) so every Holdall can install it in one click.
