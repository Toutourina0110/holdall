---
title: Permissions
description: Every permission a plugin can ask for.
---

A plugin can only do what its permissions allow. Every call is checked on the server, and always acts for the person using the plugin: a plugin never reaches another person's data.

| Permission | Meaning |
|---|---|
| `notes:read`, `notes:write` | Read, or create and change, the person's notes |
| `tasks:read`, `tasks:write` | Read, or create and complete, the person's tasks |
| `calendar:read`, `calendar:write` | Read or create calendar events |
| `files:read`, `files:write` | The person's files |
| `downloads:read`, `downloads:create` | See or start downloads |
| `network` | Call the hosts listed in `network`, over https only |
| `notifications` | Show notifications |
| `storage` | Keep private key and value data, separate for each person |
| `ui:slots` | Add a page to the navigation and widgets to **Today** |
| `ui:replace` | Replace an interface element, if the person accepts it |
| `hooks:<name>` | Receive a hook, see [Server code and hooks](/holdall/plugins/server-and-hooks/) |

Ask for as few permissions as you can. Put the ones your plugin can live without in `optionalPermissions`, and check at runtime whether a call is refused.
