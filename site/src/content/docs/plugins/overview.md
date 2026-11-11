---
title: Plugin overview
description: What a Holdall plugin is, the four types, and how to start.
---

A plugin is a `.zip` archive with a `holdall.plugin.json` manifest at its root. Holdall checks the archive, shows the permissions it asks for, and installs it only after an admin accepts. Each person then turns the plugin on for themselves on the **Plugins** page.

The built-in modules (notes, tasks, calendar, downloads, files, converter) are written with the same API as plugins, so anything they do, a plugin can do too.

## Types

| Type | What it can do |
|---|---|
| `module` | A full feature: its own page in the navigation, widgets, server code. |
| `extension` | Adds to existing modules through hooks and widgets. |
| `library` | Server code that other plugins depend on, without interface. |
| `theme` | Design tokens and filtered CSS only. No code. |

## Parts of a plugin

| Part | File | Runs in |
|---|---|---|
| Manifest | `holdall.plugin.json` | Read at install. See [Manifest](/holdall/plugins/manifest/). |
| Interface | HTML files for pages and widgets | A sandboxed iframe. See [Interface code](/holdall/plugins/interface/). |
| Server code | An ES module | Its own Node process. See [Server code and hooks](/holdall/plugins/server-and-hooks/). |
| Theme | A JSON file of tokens | Applied as CSS variables. See [Themes](/holdall/plugins/themes/). |

## Quick start

1. Copy `examples/plugins/hello-widget` from the Holdall repository. It is a Today widget that keeps a counter.
2. Change `id`, `name` and `author` in `holdall.plugin.json`.
3. Make an archive (in PowerShell, at the root of the Holdall repository):

   ```powershell
   node scripts/pack-plugin.mjs path\to\your-plugin
   ```

4. In Holdall, as an admin, open **Plugins, Install a plugin**, choose the archive, review and accept.
5. Turn it on in **On your account**, then open **Today**.

Next: [Manifest](/holdall/plugins/manifest/), [Permissions](/holdall/plugins/permissions/), and the [SDK](/holdall/plugins/sdk/).
