---
title: Use plugins
description: Turn plugins on for your account, and install them as an admin.
---

Plugins add pages, widgets on **Today**, reactions to events (for example when a note is saved) and themes. Open **Plugins** in the side bar.

## Turn a plugin on or off

**On your account** lists every plugin installed on this Holdall, except libraries, which other plugins use behind the scenes. Use **On** and **Off** to choose which ones you use. Each row shows what the plugin is allowed to do. A plugin you turn off does nothing for your account.

## Plugin settings

Some plugins have a **Settings** button on the **Plugins** page. **Your settings** are only for you. **Settings for everyone** are only shown to admins and apply to every person, for example a shared API key. Saved passwords and keys are hidden and encrypted.

## Notifications

Plugins with the **Show you notifications** permission can send you messages. The bell in the top bar shows how many are unread. Open it to read them, **Mark all as read**, delete one, or **Clear all**. Holdall keeps your last 100.

## Install a plugin (admins)

Admins see three more sections on the same page.

### From the store

**Store** lists the plugins and themes of the Holdall registry. **Get** downloads one; **Update to x.y.z** appears when a newer version exists. Every download is checked against the checksum in the listing before anything else happens.

### From an archive

**Install a plugin** accepts a `.zip` archive, or its `https` address. If you know its sha256 checksum, paste it in **Checksum** and the archive must match it exactly.

### Review the permissions

**Review the plugin** never installs anything by itself. It shows the plugin, its author and everything it asks for:

- **Required** permissions are locked. If you do not accept them, **Cancel**.
- **Optional** permissions can be unchecked.
- On an update, permissions the plugin did not have before are marked **New**.
- **Sensitive** permissions (any website, local network, running in the background) and **Dangerous** ones (any file, running programs, full access) are marked. Optional ones of these start unchecked.
- If the plugin can read your data and has an interface, a note reminds you that it could send that data to any website.
- Dangerous permissions are refused on a server unless `ALLOW_UNSAFE_PLUGINS=true`. See [Settings](/install/configuration/).

**Accept and install** installs the plugin for everyone on this Holdall. Each person then turns it on for themselves.

:::caution
Plugins that do not come from the official registry show the banner **"Third-party plugin. Not made, reviewed or endorsed by the Holdall team."** Only install plugins you trust.
:::

### Manage installed plugins

**Installed for everyone** lists installed plugins. You can change optional permissions, or **Uninstall** a plugin. Uninstalling deletes its data for every person.

## How plugins are kept apart

- A plugin's interface runs in a sandboxed frame: it cannot read your session, your cookies or the Holdall page. It can load content from any website and send data to it, so anything the plugin can read could leave the server. The review screen says so.
- A plugin's server code runs in its own process, which cannot read other files, start programs or open network connections by itself.
- Every request a plugin makes is checked against the permissions you granted, and only reaches the data of the person using it.
- **Dangerous** permissions (full access, any file, starting programs, raw network) leave that sandbox: such a plugin can read every account's data. On a server they are refused unless the admin sets `ALLOW_UNSAFE_PLUGINS=true`. The desktop app allows them, since it has one person and one computer.

Read [Write plugins](/plugins/overview/) for the details.
