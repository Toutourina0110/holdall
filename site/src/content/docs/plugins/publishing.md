---
title: Publish in the store
description: List your plugin in the Holdall registry so admins can install it in one click.
---

The store is the `index.json` file of the `holdall-registry` repository on GitHub. Holdall reads it from `PLUGIN_REGISTRY_URL` (by default the official repository) and refreshes it every 10 minutes. A template of that repository is in `examples/registry`.

## An entry

| Field | What to put |
|---|---|
| `id`, `name`, `version`, `type`, `description`, `author` | The same values as in `holdall.plugin.json` |
| `archive` | The `https` address of the release archive, for example a GitHub release asset |
| `sha256` | The checksum printed by `pack-plugin.mjs` |
| `official` | `true` only for plugins made by the Holdall team. Holdall ignores it on any other registry. |

## Publish

1. Pack your plugin (see [SDK and examples](/holdall/plugins/sdk/)).
2. Create a GitHub release in your own repository and attach the archive.
3. Open a pull request on `holdall-registry` that adds your entry to `index.json`. A check downloads the archive and compares its checksum.
4. Once merged, the plugin appears in the **Store** section of the **Plugins** page on every Holdall within 10 minutes.

When an admin installs from the store, Holdall downloads the archive, refuses it if the checksum, the id or the version differ from the listing, and then shows the same consent screen as a manual install. Plugins without `official` show the third-party banner.

## Update

Release the new archive, then change `version`, `archive` and `sha256` in your entry. Admins see **Update to x.y.z**; new permissions are asked again.

## Your own registry

Anyone can run a registry: host an `index.json` in the same format on any `https` address and set `PLUGIN_REGISTRY_URL` to it.
