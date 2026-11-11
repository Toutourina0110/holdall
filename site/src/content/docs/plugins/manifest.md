---
title: Manifest
description: The holdall.plugin.json file, its fields and the rules checked at install.
---

Every plugin has a `holdall.plugin.json` file at the root of its archive:

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

## Fields

| Field | Meaning |
|---|---|
| `id` | Unique id, a reverse domain name in lower case. |
| `name`, `description` | Shown in the store and on the consent screen. |
| `version` | Semantic version of the plugin. |
| `type` | `module`, `extension`, `library` or `theme`. |
| `author` | `name`, and an optional `url`. |
| `license` | License of the plugin. |
| `holdall` | Holdall versions it works with: `>=x.y.z`, `^x.y.z`, `~x.y.z`, an exact version or `*`. |
| `permissions` | Required permissions. See [Permissions](/holdall/plugins/permissions/). |
| `optionalPermissions` | Permissions the admin can refuse. |
| `network` | Host names the plugin may call, with the `network` permission. |
| `dependencies` | Other plugins it needs, by id and version range. |
| `entry.server` | Server code, see [Server code and hooks](/holdall/plugins/server-and-hooks/). |
| `entry.ui` | Main interface file. |
| `contributes.hooks` | Hooks the server code listens to. |
| `contributes.widgets` | Widgets for **Today**: `id`, `title`, `entry` and `width`. |
| `contributes.page` | A page in the navigation: `title` and `entry`. |

## Rules checked at install

- `id` is a reverse domain name in lower case.
- `version` and `holdall` use semantic versions.
- Every file named in the manifest is in the archive, with a relative path that stays inside it.
- Every hook in `contributes.hooks` has the matching `hooks:<name>` permission.
- `network` lists plain host names, and requires the `network` permission.
- The archive is at most 20 MB, and 60 MB and 500 files once unpacked.

Required permissions are shown as locked boxes on the consent screen; refusing them cancels the install. Optional permissions can be unchecked at install and changed later by an admin. An update that asks for new permissions shows them as **New** and asks again.

Plugins that do not come from the official registry show the banner **"Third-party plugin. Not made, reviewed or endorsed by the Holdall team."**
