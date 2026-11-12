---
title: Tooling and debugging
description: The SDK, a ready-to-copy bundler setup, the update loop, logs, and what each error means.
---

Plain JavaScript in HTML files, like in the [tutorial](/holdall/plugins/tutorial/), is enough for many plugins. For bigger ones, use TypeScript, the SDK and a bundler.

## The SDK

`@holdall/plugin-sdk` gives you:

- TypeScript types for the manifest, every [API method](/holdall/plugins/api/) and every [hook payload](/holdall/plugins/server-and-hooks/#hooks);
- `createClient()` for interface code: the `postMessage` client, typed, with a 15 second timeout;
- `applyTheme(client)`: applies the person's theme in one line;
- `definePlugin()` and `defineManifest()`: they return what you give them, and let your editor check it.

The package is not on npm yet. Copy the `packages/plugin-sdk/src` folder of the Holdall repository into your project, for example as `holdall-sdk/`.

Interface code:

```ts
import { applyTheme, createClient } from "../holdall-sdk/ui";

const holdall = createClient();
await applyTheme(holdall);
const notes = await holdall("notes.list", {});
document.getElementById("count")!.textContent = String(notes.length);
```

Server code:

```ts
import { definePlugin } from "../holdall-sdk";

export default definePlugin((holdall) => {
  holdall.on("tasks.completed", async ({ title }, context) => {
    await holdall.storage.set("last", title, context);
  });
});
```

With the SDK, `payload` in each handler has the right type for its hook.

## Bundle your interface

Your interface can load files from your archive, so a bundler is optional: you can ship `ui/app.js` next to `ui/page.html`. A bundler is still handy for TypeScript and npm packages. This setup bundles `src/<name>.ts` straight into `ui/<name>.html`.

```
my-plugin/
  holdall.plugin.json
  build.mjs
  holdall-sdk/
  src/
    widget.ts
    widget.html
  ui/
```

`src/widget.html` is a template with a placeholder where the script goes:

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body>
<strong id="count">...</strong>
<script type="module">__BUNDLE__</script>
</body>
</html>
```

`build.mjs`:

```js
import fs from "node:fs";
import { build } from "esbuild";

for (const name of ["widget"]) {
  const result = await build({ entryPoints: [`src/${name}.ts`], bundle: true, format: "esm", minify: true, write: false, target: "es2022" });
  const script = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
  const html = fs.readFileSync(`src/${name}.html`, "utf8").replace("__BUNDLE__", () => script);
  fs.mkdirSync("ui", { recursive: true });
  fs.writeFileSync(`ui/${name}.html`, html);
}
```

In PowerShell, in your plugin folder:

```powershell
npm init -y
npm install --save-dev esbuild
node build.mjs
```

Add each HTML file to the list in `build.mjs`. For server code, bundle `src/server.ts` the same way with `platform: "node"` and `outfile: "server.mjs"`, and point `entry.server` to it.

Do not pack `node_modules`, `src` or `build.mjs` into the archive if you do not need them: only what the manifest names is used. A clean way is to copy `holdall.plugin.json`, `server.mjs` and `ui/` into a `dist/` folder and pack that.

## Pack

From the root of the Holdall repository:

```powershell
node scripts/pack-plugin.mjs path\to\my-plugin
```

It zips the folder (skipping files and folders that start with a dot), writes `dist-plugins\<id>-<version>.zip` and prints the sha256 checksum. The archive is reproducible: the same files always give the same checksum.

## The update loop

1. Change your code, run your build.
2. Pack.
3. In **Plugins, Install a plugin**, choose the new archive, review, accept.

You can install the same version again while you work. Holdall replaces the files, restarts the server code at the next hook and keeps the storage. Reload the page to reload widgets and pages.

Work on a local Holdall (see [Development](/holdall/contributing/development/)), with a test account, so mistakes never touch real data.

## Read the logs

`holdall.log()`, `console.log`, errors thrown by your handlers and timeouts all go to the Holdall log, prefixed with `[your.plugin.id]`.

| Where Holdall runs | Where to read |
|---|---|
| `pnpm dev` on your computer | The terminal running it |
| Docker | `docker compose logs -f holdall`, on the server |
| Desktop app | `logs\server.log` in the [data folder](/holdall/desktop/install/#data-folder) |

Interface code runs in the browser: open the developer tools (F12), and pick your plugin's frame in the console's context menu to see its errors.

## When something does not work

| Symptom | Likely cause |
|---|---|
| The widget or page does not appear | The plugin is not turned on in **On your account**, or `ui:slots` is missing. |
| A call fails with *The plugin was not granted the X permission.* | Add X to `permissions`, or the admin refused it as optional. |
| *This plugin is turned off for this user.* | The person turned it off. Your code should show this message and stop. |
| *Invalid parameters for X.* | A parameter is missing or has the wrong type. Check the [API reference](/holdall/plugins/api/). |
| *Unknown plugin API method X.* | A typo in the method name, or a method this Holdall version does not have. |
| *API calls are only allowed while Holdall is calling the plugin, or with the background permission...* | Server code called the API outside a handler without `background`, or with a `context` for someone who did not turn the plugin on. |
| *The plugin did not declare X in its network list.* | Add the host to `network`. |
| *Plugins can only use https addresses.* | Use `https://`. |
| *X took too long to answer.* | A hook handler took more than 5 seconds (15 for `notes.export.render`), a server function or library call more than 30, or an interface call more than 15. |
| *The plugin has no server function named X.* | `server.call` used a name your server code never registered with `holdall.handle`, or the server code failed at start (read the log). |
| *Declare X in dependencies to call it.* | Add the library to `dependencies` in your manifest. |
| *X is not an installed library.* or *does not match* | The admin must install the library, in a version that matches your range. |
| *The plugin was not granted the storage permission.* | `holdall.userDir` and `holdall.sharedDir` need `storage`. |
| Install says *... which can harm this server* | The plugin needs a dangerous permission and the server does not allow them. See [Dangerous permissions](/holdall/plugins/permissions/#dangerous-permissions). |
| *Only pages can change the address.* | `page.navigate` was called from a widget. |
| *The call is larger than 24 MB.* | Send less at once, or move big files through your data folder from server code. |
| Uninstall says *Uninstall X first* | Another plugin depends on this library. Uninstall it first. |
| A hook never runs | It is missing from `contributes.hooks`, the `hooks:<name>` permission or the data permission is missing, or the default export did not call `holdall.on`. |
| A filter seems ignored | Your answer was not valid, so Holdall kept its own value. The log says *Plugin filter returned an invalid value*. |
| Install says *needs Holdall X* | Change `holdall` in the manifest, or update Holdall. |
| Install says *needs the plugin X* | Install that plugin first, in a matching version. |
| The page looks wrong in dark mode | Call `theme.tokens` and use the CSS variables instead of fixed colors. |
