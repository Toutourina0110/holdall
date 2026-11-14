---
title: Permissions
description: Every permission a plugin can ask for, and what it unlocks.
---

A plugin can only do what its permissions allow. Every call is checked on the server, and always acts for the person using the plugin: a plugin never reaches another person's data, even with every permission.

The **Shown as** column is the sentence people read on the consent screen.

| Permission | Shown as | Unlocks |
|---|---|---|
| `notes:read` | Read all your notes | `notes.list`, `notes.get`, hooks on notes |
| `notes:write` | Create, change and delete your notes | `notes.create`, `notes.update`, `notes.trash`, `notes.restore`, `notes.move`, `notes.setTags`, `notes.setFlags` |
| `tasks:read` | Read all your tasks | `tasks.list`, `tasks.lists`, `tasks.completed` hook |
| `tasks:write` | Create, change and delete your tasks | `tasks.create`, `tasks.complete`, `tasks.update`, `tasks.delete`, `tasks.createList`, `tasks.renameList`, `tasks.deleteList` |
| `calendar:read` | Read your calendar events | `calendar.list`, `calendar.event.render` hook |
| `calendar:write` | Create, change and delete your calendar events | `calendar.create`, `calendar.update`, `calendar.delete` |
| `files:read` | Read your files | `files.list`, `files.read` |
| `files:write` | Create, change and delete your files | `files.write`, `files.mkdir`, `files.rename`, `files.move`, `files.delete` |
| `downloads:read` | See your downloads | `downloads.list`, `download.finished` hook |
| `downloads:create` | Start downloads for you | `downloads.create` |
| `network` | Connect to the internet addresses listed below | `network.fetch`, to the hosts in `network` |
| `notifications` | Show you notifications | `notifications.show` |
| `storage` | Keep its own private data and files on this server | `storage.get`, `storage.set`, `storage.delete`, and the [data folder](/plugins/server-and-hooks/#data-folder) |
| `background` | Keep running in the background and act for you at any time | Starting with Holdall, `holdall.users()`, `holdall.as(userId)` |
| `ui:slots` | Add elements to the interface | Widgets, a page, the `dashboard.widgets` hook |
| `network:any` | Connect to any address on the internet | `network.fetch` to any public `http` or `https` address, without listing hosts |
| `network:local` | Connect to any address, including devices on your local network | Same as `network:any`, plus private addresses like `192.168.1.10` |
| `network:direct` | Open its own network connections to any address | Server code uses `fetch`, `WebSocket` or any network library directly |
| `fs:host` | Read and change any file on this computer or server | Server code uses `fs` anywhere |
| `process:spawn` | Start programs on this computer or server | Server code uses `child_process` |
| `system` | Full access | Server code runs as plain Node, with no sandbox at all |
| `ui:replace` | Replace elements of the interface | Nothing yet, see [Not available yet](/plugins/overview/#not-available-yet) |
| `hooks:<name>` | The hook's description | Receiving that hook, see [Server code and hooks](/plugins/server-and-hooks/) |

A hook also needs the permission of the data it carries: `hooks:notes.saved` is useless without `notes:read`.

## Sensitive and dangerous permissions

Some permissions are marked on the review screen:

| Mark | Permissions | Why |
|---|---|---|
| **Sensitive** | `network:any`, `network:local`, `background` | The plugin can send what it reads anywhere, reach the machines of the local network, or act for you when you are not using it. |
| **Dangerous** | `network:direct`, `fs:host`, `process:spawn`, `system` | The plugin leaves the sandbox: it can read every account's data, change any file, or run programs. |

### Dangerous permissions

Dangerous permissions only work where the admin allows them with `ALLOW_UNSAFE_PLUGINS=true`. It is on by default in the desktop app, where there is one person and one computer, and off by default on a server.

When it is off:

- a plugin that **requires** a dangerous permission is refused at install, with a message naming the setting;
- a dangerous **optional** permission is shown unchecked and cannot be granted;
- if the setting is turned off later, dangerous permissions already granted stop working at the next start of the plugin.

With these permissions, server code gets:

| Permission | Server code can |
|---|---|
| `network:direct` | Use `fetch`, `WebSocket`, `net` or any network library directly, to any address |
| `fs:host` | Read and write any file the Holdall process can, and use WASI |
| `process:spawn` | Start programs with `child_process`, with the system `PATH`, and use worker threads |
| `system` | Everything Node can do: no permission model, native addons, no memory cap |

Prefer the narrowest one: `process:spawn` to run one tool, `network:direct` for a WebSocket library, `system` only when nothing else works.

## Required or optional

- Put in `permissions` what your plugin cannot work without.
- Put in `optionalPermissions` what only adds something. The admin can refuse it, and change it later from **Plugins, Installed for everyone**.
- When an optional permission is missing, calls that need it fail with *The plugin was not granted the `<permission>` permission.* Catch that error and keep working without the feature.

## Good practice

- Ask for as little as possible. People are more likely to install a plugin that asks for two permissions than for ten.
- Prefer `read` over `write` when you only display data.
- Declare exactly the hosts you call in `network` when you can. With only `network`, Holdall refuses any other host, plain `http`, and private network addresses. Ask for `network:any` only if the hosts are chosen by the person (a feed reader, a webhook).
