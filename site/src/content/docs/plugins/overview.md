---
title: Plugin overview
description: What a Holdall plugin can do, how it is built, and where to start.
---

A plugin adds features to Holdall: a widget on **Today**, a page in the side bar, reactions to what people do (a note saved, a task completed), new export formats, or a whole theme. It is a `.zip` archive with a `holdall.plugin.json` manifest at its root.

An admin installs it once for the whole server, after reviewing what it asks for. Then each person turns it on for themselves on the **Plugins** page. The built-in modules (notes, tasks, calendar, downloads, files) are written with the same API, so anything they do, a plugin can do too.

## What a plugin can do

| Goal | How | Read |
|---|---|---|
| Show something on Today | A widget: an HTML file | [Interface code](/holdall/plugins/interface/) |
| Have its own page in the side bar, with an icon and sub pages | A page: an HTML file | [Manifest](/holdall/plugins/manifest/#page) |
| Give each screen a shareable address | `page.navigate` | [Interface code](/holdall/plugins/interface/#pages-and-addresses) |
| Read or change notes, tasks, events, files | API methods, each behind a permission | [API reference](/holdall/plugins/api/) |
| Start downloads | `downloads.create` | [API reference](/holdall/plugins/api/) |
| Load libraries, images, videos, players from any site | Directly in your interface | [Interface code](/holdall/plugins/interface/) |
| Call a web API | `fetch()` in the interface, or `network.fetch` from the server | [Interface code](/holdall/plugins/interface/#fetch-or-networkfetch) |
| Run your own logic on the server, keep API keys secret | Server functions, called from the interface | [Server code](/holdall/plugins/server-and-hooks/#server-functions) |
| Update the screen live | Live events pushed from the server | [Server code](/holdall/plugins/server-and-hooks/#live-events) |
| Remember things | Private storage, separate for each person | [API reference](/holdall/plugins/api/) |
| Notify the person | `notifications.show`, shown under the bell in the top bar | [API reference](/holdall/plugins/api/) |
| React when something happens | Action hooks, in server code | [Server code and hooks](/holdall/plugins/server-and-hooks/) |
| Change what Holdall shows | Filter hooks: export formats, event titles and colors, Today widgets | [Server code and hooks](/holdall/plugins/server-and-hooks/) |
| Run programs, use any file, open raw connections | Dangerous permissions, where the admin allows them | [Permissions](/holdall/plugins/permissions/#dangerous-permissions) |
| Restyle Holdall | A theme plugin | [Themes](/holdall/plugins/themes/) |

## Types

| Type | Use it for |
|---|---|
| `module` | A full feature with its own page, usually with widgets and server code. |
| `extension` | Something that adds to existing modules: widgets, hooks, export formats. |
| `theme` | Colors, sizes and a little CSS. No code. |
| `library` | Reserved. See [Not available yet](#not-available-yet). |

`module` and `extension` work the same way; the type only tells people what to expect.

## How a plugin is kept safe

- **Interface code** runs in a sandboxed iframe. It cannot read the session, the cookies or the Holdall page. It talks to Holdall only through messages.
- **Server code** runs in its own Node process, which cannot read other files, write files, start programs or open network connections by itself, unless the plugin was granted a [dangerous permission](/holdall/plugins/permissions/#dangerous-permissions).
- **Every call** is checked against the permissions the admin granted, and only reaches the data of the person using the plugin.
- **Plugins outside the official registry** show a banner saying they are not reviewed by the Holdall team.

## Where to start

1. Follow the [tutorial](/holdall/plugins/tutorial/): you build, install and update a real plugin in about 20 minutes.
2. Keep the [API reference](/holdall/plugins/api/) and the [manifest reference](/holdall/plugins/manifest/) open while you work.
3. Read [Tooling and debugging](/holdall/plugins/tooling/) when something does not work.
4. [Publish it in the store](/holdall/plugins/publishing/) when it is ready.

## Not available yet

These are accepted in a manifest, but do nothing yet. Do not rely on them:

- the `ui:replace` permission, to replace an element of the Holdall interface;
- `library` plugins, to share code between plugins. `dependencies` is checked at install (the other plugin must be installed, in a matching version), but a plugin cannot call another plugin's code;
- `contributes.slots`.
