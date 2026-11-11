---
title: Permissions
description: Every permission a plugin can ask for, and what it unlocks.
---

A plugin can only do what its permissions allow. Every call is checked on the server, and always acts for the person using the plugin: a plugin never reaches another person's data, even with every permission.

The **Shown as** column is the sentence people read on the consent screen.

| Permission | Shown as | Unlocks |
|---|---|---|
| `notes:read` | Read all your notes | `notes.list`, `notes.get`, hooks on notes |
| `notes:write` | Create, change and delete your notes | `notes.create`, `notes.update` |
| `tasks:read` | Read all your tasks | `tasks.list`, `tasks.completed` hook |
| `tasks:write` | Create, change and delete your tasks | `tasks.create`, `tasks.complete` |
| `calendar:read` | Read your calendar events | `calendar.list`, `calendar.event.render` hook |
| `calendar:write` | Create, change and delete your calendar events | `calendar.create` |
| `files:read` | Read your files | `files.list`, `files.read` |
| `files:write` | Create, change and delete your files | `files.write`, `files.delete` |
| `downloads:read` | See your downloads | `downloads.list`, `download.finished` hook |
| `downloads:create` | Start downloads for you | `downloads.create` |
| `network` | Connect to the internet addresses listed below | `network.fetch`, to the hosts in `network` |
| `notifications` | Show you notifications | `notifications.show` |
| `storage` | Keep its own private data on this server | `storage.get`, `storage.set`, `storage.delete` |
| `ui:slots` | Add elements to the interface | Widgets, a page, the `dashboard.widgets` hook |
| `ui:replace` | Replace elements of the interface | Nothing yet, see [Not available yet](/holdall/plugins/overview/#not-available-yet) |
| `hooks:<name>` | The hook's description | Receiving that hook, see [Server code and hooks](/holdall/plugins/server-and-hooks/) |

A hook also needs the permission of the data it carries: `hooks:notes.saved` is useless without `notes:read`.

## Required or optional

- Put in `permissions` what your plugin cannot work without.
- Put in `optionalPermissions` what only adds something. The admin can refuse it, and change it later from **Plugins, Installed for everyone**.
- When an optional permission is missing, calls that need it fail with *The plugin was not granted the `<permission>` permission.* Catch that error and keep working without the feature.

## Good practice

- Ask for as little as possible. People are more likely to install a plugin that asks for two permissions than for ten.
- Prefer `read` over `write` when you only display data.
- Declare exactly the hosts you call in `network`. Holdall refuses any other host, plain `http`, and private network addresses.
