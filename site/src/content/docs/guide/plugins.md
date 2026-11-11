---
title: Use plugins
description: Turn plugins on for your account, and install them as an admin.
---

Plugins add pages, widgets on **Today**, reactions to events (for example when a note is saved) and themes. Open **Plugins** in the side bar.

## Turn a plugin on or off

**On your account** lists every plugin installed on this Holdall. Use **On** and **Off** to choose which ones you use. Each row shows what the plugin is allowed to do. A plugin you turn off does nothing for your account.

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

**Accept and install** installs the plugin for everyone on this Holdall. Each person then turns it on for themselves.

:::caution
Plugins that do not come from the official registry show the banner **"Third-party plugin. Not made, reviewed or endorsed by the Holdall team."** Only install plugins you trust.
:::

### Manage installed plugins

**Installed for everyone** lists installed plugins. You can change optional permissions, or **Uninstall** a plugin. Uninstalling deletes its data for every person.

## How plugins are kept apart

- A plugin's interface runs in a sandboxed frame: it cannot read your session, your cookies or the Holdall page.
- A plugin's server code runs in its own process, which cannot read other files, start programs or open network connections by itself.
- Every request a plugin makes is checked against the permissions you granted, and only reaches the data of the person using it.

Read [Write plugins](/holdall/plugins/overview/) for the details.
