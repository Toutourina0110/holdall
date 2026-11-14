---
title: Publish in the store
description: List your plugin in the Holdall registry so every admin can install it in one click.
---

The store is the `index.json` file of the `holdall-registry` repository on GitHub. Every Holdall reads it from `PLUGIN_REGISTRY_URL` (by default the official repository) and refreshes it every 10 minutes. A template of that repository is in `examples/registry`.

## An entry

```json
{
  "id": "io.github.you.word-count",
  "name": "Word count",
  "version": "1.0.0",
  "type": "extension",
  "description": "Counts the words in the notes you edit each day.",
  "author": { "name": "Your name", "url": "https://github.com/you" },
  "archive": "https://github.com/you/word-count/releases/download/v1.0.0/io.github.you.word-count-1.0.0.zip",
  "sha256": "3a51f2ea3e8a038f5d33bff6ccb461c2f6f694af402fdf4541daa5095d65093d"
}
```

| Field | What to put |
|---|---|
| `id`, `name`, `version`, `type`, `description`, `author` | The same values as in `holdall.plugin.json` |
| `archive` | The `https` address of the release archive, for example a GitHub release asset |
| `sha256` | The checksum printed by `pack-plugin.mjs` |
| `official` | Leave it out. Only plugins made by the Holdall team have it, and Holdall ignores it on any other registry. |

## Publish

1. Go through the [checklist](#checklist-before-you-publish).
2. Pack your plugin (see [Tooling](/holdall/plugins/tooling/#pack)) and note the checksum.
3. Create a GitHub release in your own repository and attach the archive.
4. Open a pull request on `holdall-registry` that adds your entry to `index.json`. A check validates the entry, downloads the archive and compares its checksum. Holdall checks the manifest itself when an admin installs the plugin.
5. Once merged, the plugin appears in the **Store** section of the **Plugins** page on every Holdall within 10 minutes.

When an admin installs from the store, Holdall downloads the archive and refuses it if the checksum, the id or the version differ from the listing. Then it shows the same review screen as a manual install, with the third-party banner.

## Update

Release the new archive, then change `version`, `archive` and `sha256` in your entry with a new pull request. Admins see **Update to x.y.z**. New permissions are shown as **New** and asked again.

Never replace the archive of a version that is already listed: its checksum would no longer match, and every install would be refused.

## Checklist before you publish

**Manifest**

- [ ] `id` is yours (your domain or `io.github.yourname`) and will never change.
- [ ] `version` is raised since the last release.
- [ ] `description` says in one sentence what the plugin does.
- [ ] `holdall` names the oldest Holdall version you tested.
- [ ] Every permission is needed; the nice-to-have ones are in `optionalPermissions`.
- [ ] Dangerous permissions only if nothing else works. Most servers refuse them; say so in your README.
- [ ] `network` lists only the hosts you really call.

**Behavior**

- [ ] It works with every optional permission refused.
- [ ] Every call has error handling, and errors are shown in the frame, not swallowed.
- [ ] Server handlers answer in well under 5 seconds.
- [ ] Data from notes, files or the network is shown with `textContent`, never `innerHTML`.
- [ ] Storage values stay small (each is limited to 256 KB).

**Looks**

- [ ] It uses `theme.tokens` and looks right in light and dark themes.
- [ ] It works at 375 px wide.
- [ ] Text is readable: no light grey on white.

**Archive**

- [ ] It contains only what the plugin uses: no `node_modules`, no sources, no secrets.
- [ ] It installs on a clean Holdall, and updates over the previous version.
- [ ] Your repository has a README and a license.

## Your own registry

Anyone can run a registry: host an `index.json` with `"version": 1` and a `plugins` list in the same format, on any `https` address, and set `PLUGIN_REGISTRY_URL` to it. Useful for a company or a family that wants its own list.
