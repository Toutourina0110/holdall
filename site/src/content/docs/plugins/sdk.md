---
title: SDK and examples
description: The @holdall/plugin-sdk package, the example plugins, and how to pack an archive.
---

## SDK

`packages/plugin-sdk` (`@holdall/plugin-sdk`) gives TypeScript types for the manifest, the hooks and every method, plus a small client for interface code:

```ts
import { applyTheme, createClient } from "@holdall/plugin-sdk/ui";

const holdall = createClient();
await applyTheme(holdall);
const notes = await holdall("notes.list", {});
```

For server code:

```ts
import { definePlugin } from "@holdall/plugin-sdk";

export default definePlugin((holdall) => {
  holdall.on("tasks.completed", async (payload, context) => {
    await holdall.storage.set("last", payload.title, context);
  });
});
```

`defineManifest` gives you type checking while you write the manifest in TypeScript.

The package is not on npm yet. Until it is, copy the `packages/plugin-sdk/src` folder of the Holdall repository into your project.

Bundle and inline the SDK into your HTML files (with esbuild, Vite or any bundler), since the sandbox cannot load other files from Holdall.

## Examples

Working examples live in `examples/plugins` of the Holdall repository:

| Folder | Shows |
|---|---|
| `hello-widget` | A Today widget that keeps a counter in plugin storage |
| `notes-streak` | Server code that listens to `notes.saved`, and a widget that reads the result |
| `paper-theme` | A theme plugin |

## Pack an archive

From the root of the Holdall repository, in PowerShell:

```powershell
node scripts/pack-plugin.mjs examples/plugins/hello-widget
```

The archive is written to `dist-plugins`, and the command prints its sha256 checksum. The archive is reproducible: the same files always give the same checksum.
