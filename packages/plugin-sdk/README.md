# @holdall/plugin-sdk

Types and small helpers for writing Holdall plugins. The full guide is at https://toutourina0110.github.io/holdall/plugins/overview/

## Server code

```ts
import { definePlugin } from "@holdall/plugin-sdk";

export default definePlugin((holdall) => {
  holdall.on("notes.saved", async (payload, context) => {
    const count = Number((await holdall.storage.get("saves", context)) ?? 0) + 1;
    await holdall.storage.set("saves", count, context);
  });
});
```

Bundle it into one ES module (for example with esbuild) and point `entry.server` in `holdall.plugin.json` to it.

## Interface code

```ts
import { applyTheme, createClient } from "@holdall/plugin-sdk/ui";

const holdall = createClient();
await applyTheme(holdall);
const notes = await holdall("notes.list", {});
```

Interface files run in a sandboxed iframe, so bundle and inline the script into your HTML file.

## Manifest

`defineManifest` only checks types while you write the manifest. Holdall checks it again at install.
