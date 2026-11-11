# Writing Holdall plugins

A plugin is a `.zip` archive with a `holdall.plugin.json` manifest at its root. Holdall checks the archive, shows the permissions it asks for, and installs it only after an admin accepts. Each person then turns the plugin on for themselves in **Settings, Plugins**.

A working example lives in `examples/plugins/hello-widget`.

## 1. Types

| Type | What it can do |
|---|---|
| `module` | A full feature: its own page in the navigation, widgets, server code. |
| `extension` | Adds to existing modules through hooks and widgets. |
| `library` | Server code that other plugins depend on, without interface. |
| `theme` | Design tokens and filtered CSS only. No code. |

## 2. Manifest

```json
{
  "id": "com.example.notes-word-count",
  "name": "Word count",
  "version": "1.0.0",
  "type": "extension",
  "description": "Shows how many words you wrote today.",
  "author": { "name": "Example Dev", "url": "https://github.com/example" },
  "license": "MIT",
  "holdall": ">=0.1.0",
  "permissions": ["ui:slots", "storage", "notes:read", "hooks:notes.saved"],
  "optionalPermissions": ["network"],
  "network": ["api.example.com"],
  "dependencies": {},
  "entry": { "server": "dist/server.mjs", "ui": "ui/page.html" },
  "contributes": {
    "hooks": ["notes.saved"],
    "widgets": [{ "id": "today", "title": "Words today", "entry": "ui/widget.html", "width": 1 }],
    "page": { "title": "Word count", "entry": "ui/page.html" }
  }
}
```

Rules checked at install:

- `id` is a reverse domain name in lower case.
- `version` and `holdall` use semantic versions. `holdall` accepts `>=x.y.z`, `^x.y.z`, `~x.y.z`, an exact version or `*`.
- Every file named in the manifest must be in the archive, with a relative path that stays inside it.
- Every hook in `contributes.hooks` needs the matching `hooks:<name>` permission.
- `network` lists plain host names. It requires the `network` permission.
- The archive is at most 20 MB (60 MB unpacked, 500 files).

Required permissions (`permissions`) are shown as locked boxes on the consent screen; refusing them cancels the install. Optional permissions (`optionalPermissions`) can be unchecked at install and changed later by an admin. An update that asks for new permissions shows them as **New** and asks again.

Plugins that do not come from the official registry show the banner **"Third-party plugin. Not made, reviewed or endorsed by the Holdall team."**

## 3. Permissions

| Permission | Meaning |
|---|---|
| `notes:read`, `notes:write` | Read, or create and change, the user's notes |
| `tasks:read`, `tasks:write` | Read, or create and complete, the user's tasks |
| `calendar:read`, `calendar:write` | Calendar events |
| `files:read`, `files:write` | The user's files |
| `downloads:read`, `downloads:create` | See or start downloads |
| `network` | Call the hosts listed in `network`, over https only |
| `notifications` | Show notifications |
| `storage` | Keep private key and value data, separate for each user |
| `ui:slots` | Add a page to the navigation and widgets to Today |
| `ui:replace` | Replace an interface element, if the user accepts it |
| `hooks:<name>` | Receive a hook (see section 5) |

## 4. Interface code

Pages and widgets are HTML files shown in a sandboxed iframe (`sandbox="allow-scripts"`, no same origin). They cannot read cookies, the session or the Holdall page. Keep each file self-contained: inline its scripts and styles, because requests made from inside the sandbox carry no session.

Talk to Holdall with `postMessage`:

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

Methods:

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

## 5. Server code and hooks

`entry.server` is an ES module whose default export receives a `holdall` object:

```js
export default function (holdall) {
  holdall.on("notes.saved", async (payload, context) => {
    const count = ((await holdall.storage.get("saves", context)) ?? 0) + 1;
    await holdall.storage.set("saves", count, context);
  });
}
```

Server code runs in its own Node process started with the Node permission model: it can read its own folder only, cannot write files, start programs, open network connections or load native addons, and is limited to 128 MB of memory. Everything goes through `holdall` calls, checked against the granted permissions. API calls are only accepted while Holdall is calling one of your hooks, and always act for the user of that call (pass `context` as the last argument).

The Node permission model limits what ordinary code can do; it is not a full security boundary against a determined attacker who finds a bug in Node itself. Only install plugins you trust.

Hooks:

| Hook | Kind | Payload | Permission |
|---|---|---|---|
| `notes.saved` | action | `{ id, title }` | `notes:read` |
| `notes.deleted` | action | `{ id }` | `notes:read` |
| `notes.export.formats` | filter | list of formats | `notes:read` |
| `tasks.completed` | action | `{ id, title }` | `tasks:read` |
| `download.finished` | action | `{ id, file, title }` | `downloads:read` |
| `calendar.event.render` | filter | event | `calendar:read` |
| `dashboard.widgets` | filter | widget list | `ui:slots` |

An action is a notification; its return value is ignored. A filter receives a value and returns the changed value; an invalid answer is ignored. Each call times out after 5 seconds.

## 6. Themes

A theme plugin has `"type": "theme"`, no `entry`, and a `theme` file:

```json
{
  "name": "Solarized",
  "base": "light",
  "tokens": { "--color-ground": "#fdf6e3", "--color-accent": "#268bd2", "--radius-panel": "4px" },
  "css": ".some-class { letter-spacing: 0.01em; }"
}
```

Only known tokens are accepted, with color or size values. The CSS cannot use `url()`, `@import`, `@font-face`, `expression()`, backslash escapes or `</`, so a theme can never load anything from the internet. Installed theme plugins are listed in **Settings, Appearance**, where each person can pick one. Users can also build and export themes there.

## 7. SDK and examples

`packages/plugin-sdk` (`@holdall/plugin-sdk`) gives TypeScript types for the manifest, the hooks and every method above, plus a small client for interface code:

```ts
import { applyTheme, createClient } from "@holdall/plugin-sdk/ui";

const holdall = createClient();
await applyTheme(holdall);
const notes = await holdall("notes.list", {});
```

Bundle and inline it into your HTML file, since the sandbox cannot load other files from Holdall.

Working examples live in `examples/plugins`:

| Folder | Shows |
|---|---|
| `hello-widget` | A Today widget that keeps a counter in plugin storage |
| `notes-streak` | Server code that listens to `notes.saved`, and a widget that reads the result |
| `paper-theme` | A theme plugin |

Make an archive from a plugin folder and print its checksum:

```powershell
node scripts/pack-plugin.mjs examples/plugins/hello-widget
```

The archive is written to `dist-plugins`.

## 8. Publishing in the store

The store is the `index.json` file of the `holdall-registry` repository on GitHub. Holdall reads it from `PLUGIN_REGISTRY_URL` (by default the official repository). A template of that repository is in `examples/registry`.

Each entry:

| Field | What to put |
|---|---|
| `id`, `name`, `version`, `type`, `description`, `author` | The same values as in `holdall.plugin.json` |
| `archive` | The https address of the release archive, for example a GitHub release asset |
| `sha256` | The checksum printed by `pack-plugin.mjs` |
| `official` | `true` only for plugins made by the Holdall team. Holdall ignores it on any other registry. |

To publish:

1. Create a GitHub release in your own repository and attach the archive.
2. Open a pull request on `holdall-registry` that adds your entry to `index.json`. The check downloads the archive and compares its checksum.
3. Once merged, the plugin appears in **Admin, Plugins, Store** on every Holdall within 10 minutes.

When an admin installs from the store, Holdall downloads the archive, refuses it if the checksum or the id and version differ from the listing, and then shows the same consent screen as a manual install. Plugins without `official` show the third-party banner.

To publish an update, release the new archive and change `version`, `archive` and `sha256` in your entry. Admins see **Update to x.y.z**; new permissions are asked again.
