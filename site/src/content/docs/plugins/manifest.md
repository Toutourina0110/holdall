---
title: Manifest reference
description: Every field of holdall.plugin.json and the rules checked at install.
---

Every plugin has a `holdall.plugin.json` file at the root of its archive. Holdall reads it before anything else, refuses the archive if it is invalid, and shows the person installing it exactly what it says.

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
  "optionalPermissions": ["network", "notifications"],
  "network": ["api.example.com"],
  "entry": { "server": "dist/server.mjs", "ui": "ui/page.html" },
  "contributes": {
    "hooks": ["notes.saved"],
    "widgets": [{ "id": "today", "title": "Words today", "entry": "ui/widget.html", "width": 1 }],
    "page": { "title": "Word count", "entry": "ui/page.html" }
  }
}
```

## Fields

| Field | Required | Rules | Meaning |
|---|---|---|---|
| `id` | yes | Reverse domain name in lower case, for example `io.github.you.word-count` | Unique id. Never change it: Holdall uses it to recognize updates and keep data. |
| `name` | yes | 1 to 60 characters | Shown in the store, the consent screen and notifications. |
| `version` | yes | Semantic version, like `1.2.0` | Raise it for every release. |
| `type` | yes | `module`, `extension`, `theme` or `library` | See [types](/holdall/plugins/overview/#types). |
| `description` | no | Up to 300 characters | One sentence about what it does. |
| `author` | yes | `name` (up to 80 characters), optional `url` | Who made it. |
| `license` | yes | Up to 40 characters, for example `MIT` | The license of your code. |
| `holdall` | yes | `>=x.y.z`, `^x.y.z`, `~x.y.z`, an exact version or `*` | Holdall versions it works with. Install is refused on others. |
| `permissions` | no | Known permissions, up to 40 | Required. Refusing one cancels the install. See [Permissions](/holdall/plugins/permissions/). |
| `optionalPermissions` | no | Known permissions, up to 40 | The admin can uncheck them at install and change them later. |
| `network` | no | Plain host names, up to 20 | Hosts `network.fetch` may call with the `network` permission. Not needed with `network:any` or `network:local`. |
| `dependencies` | no | `{ "plugin.id": "version range" }` | Plugins that must be installed first, in a matching version. Your server code can call the [libraries](/holdall/plugins/server-and-hooks/#libraries) listed here. |
| `entry.server` | no | Relative path to a file in the archive | Server code. See [Server code and hooks](/holdall/plugins/server-and-hooks/). |
| `entry.ui` | no | Relative path | Main interface file. |
| `theme` | theme only | Relative path | Theme file. See [Themes](/holdall/plugins/themes/). |
| `contributes.hooks` | no | Known hook names | Hooks your server code listens to. Each needs its `hooks:<name>` permission. |
| `contributes.widgets` | no | Up to 10 | Widgets for **Today**. See below. |
| `contributes.page` | no | `title` (up to 40 characters), `entry`, optional `icon` and `pages` | A page in the side bar, with sub pages. See [Page](#page). |
| `contributes.settings` | no | Up to 40 fields | A settings form drawn by Holdall. See [Settings](#settings). |

Unknown fields are refused, so a typo is caught at install instead of being ignored.

## Widgets

```json
{ "id": "today", "title": "Words today", "entry": "ui/widget.html", "width": 1 }
```

- `id`: lower case letters, digits and dashes, unique inside your plugin.
- `title`: the heading Holdall draws above the widget. People can rename it in **Customize**.
- `entry`: the HTML file.
- `width`: `1`, `2` or `3` columns of the Today grid. On a phone every widget takes the full width.

Widgets need the `ui:slots` permission. They appear on **Today** for each person who turns the plugin on; people can move and hide them in **Customize**.

## Page

```json
{
  "title": "TV",
  "entry": "ui/page.html",
  "icon": "ui/icon.svg",
  "pages": [
    { "title": "Live", "path": "live" },
    { "title": "Saved", "path": "saved" }
  ]
}
```

- The page gets an entry in the side bar, named `title`, and opens at `/p/<plugin id>`. It fills the content area. It needs the `ui:slots` permission.
- `icon`: an `.svg` file of your archive. Holdall draws it in one color, the color of the side bar, so it matches every theme. Use simple filled shapes on a 16 by 16 grid.
- `pages`: up to 20 sub pages. When someone opens your page, they unfold under it in the side bar. Each one opens `/p/<plugin id>/<path>`, with the same `entry` file. `path` uses letters, digits and `. _ ~ -`, with `/` between parts.
- Any address under `/p/<plugin id>/` opens your page, not only the listed ones, so you can give each item its own shareable address, like `/p/com.example.tv/channels/42`. See [Pages and addresses](/holdall/plugins/interface/#pages-and-addresses).

## Settings

Declare your settings and Holdall draws the form, validates the values, encrypts secrets and stores everything. A **Settings** button appears next to your plugin on the **Plugins** page.

```json
"settings": [
  { "key": "apiKey", "label": "API key", "type": "secret", "scope": "global", "description": "From your weather provider account.", "required": true },
  { "key": "city", "label": "City", "type": "text", "scope": "personal", "default": "Paris" },
  { "key": "units", "label": "Units", "type": "select", "scope": "personal", "options": [{ "value": "c", "label": "Celsius" }, { "value": "f", "label": "Fahrenheit" }] },
  { "key": "days", "label": "Days to show", "type": "number", "scope": "personal", "min": 1, "max": 7, "default": 3 },
  { "key": "alerts", "label": "Show alerts", "type": "boolean", "scope": "personal" }
]
```

| Field | Meaning |
|---|---|
| `key` | Name of the value, a letter then letters, digits or `_`, up to 40 characters. Unique. |
| `label` | What people read, up to 60 characters. |
| `description` | Help under the field, up to 300 characters. |
| `type` | `text`, `textarea`, `number`, `boolean`, `select`, `url` or `secret`. |
| `scope` | `personal` (default): each person sets their own. `global`: one value for everyone, set by admins. |
| `default` | Value used until someone saves one. Not used for `secret`. |
| `options` | For `select`: the list of `{ value, label }`. Required for that type. |
| `min`, `max` | For `number`. |
| `required` | The form refuses an empty value. |

- `secret` values (API keys, passwords) are encrypted at rest with `APP_SECRET`. The form never shows them again; leaving the field empty keeps the saved value.
- Only your **server code** can read a secret. Your interface gets `true` when it is set and `null` when it is not, so a key never reaches the browser.
- Personal settings are deleted with the person's account; all settings are deleted when the plugin is uninstalled.

Read them with [`settings.get`](/holdall/plugins/api/#settingsget).

## Rules checked at install

- `id`, `version` and `holdall` are valid, and this Holdall matches `holdall`.
- Every plugin in `dependencies` is installed, in a matching version.
- Every file named in the manifest is in the archive, with a relative path that stays inside it.
- Every hook in `contributes.hooks` has the matching `hooks:<name>` permission.
- `network` is only used with the `network`, `network:any` or `network:local` permission.
- A theme plugin has a valid `theme` file and no `entry`.
- The archive is at most 20 MB, and 60 MB and 500 files once unpacked.

Install errors name the problem, for example: *Word count needs Holdall >=0.2.0. This Holdall is 0.1.0.*
