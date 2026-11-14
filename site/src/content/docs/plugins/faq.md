---
title: Plugin FAQ
description: Common questions about writing Holdall plugins.
---

## Do I need server code?

No. Many plugins are only a widget or a page that calls the API. Add server code when you must react to something (a note saved, a download finished), answer a filter, keep an API key secret, or work in the background.

## Can my interface code use `fetch()` or load a library from a CDN?

Yes. Your interface can load scripts, styles, fonts, images and videos from any site, embed other sites, and call web APIs that allow CORS. It never sees the Holdall session. For APIs without CORS, or with a secret key, call them from your server code.

## Can I embed a video or a live stream?

Yes. Use the player the site gives you (an `<iframe>` or its script). Fullscreen and autoplay are allowed.

## Can my server code use npm packages?

Yes, if you bundle them into your server file. Packages that need native addons, write files, start programs or open network connections need the matching [dangerous permission](/holdall/plugins/permissions/#dangerous-permissions).

## Can a plugin really do anything?

Almost. With `system`, its server code runs as plain Node with no sandbox, on servers where the admin allowed it. The only thing no plugin ever gets is the Holdall session of the person using it.

## Can my server code run on a timer?

Yes, with the `background` permission: use `setInterval`, then `holdall.users()` and `holdall.as(userId)` to act for each person who turned the plugin on. See [Background code](/holdall/plugins/server-and-hooks/#background-code).

## Where do I keep settings?

Declare them in the manifest and Holdall draws the form for you, with personal and global values and encrypted secrets. See [Settings](/holdall/plugins/manifest/#settings). For anything more complex, use storage and your own form. Bigger data goes in your [data folder](/holdall/plugins/server-and-hooks/#data-folder).

## Can I use SQLite or keep big files?

Yes, in your [data folder](/holdall/plugins/server-and-hooks/#data-folder). A pure JavaScript or WebAssembly SQLite works in the sandbox; a native one needs `system`.

## How do I know who is using the plugin?

You don't need to: every call already acts for the right person. `context.userId` exists in server code, but Holdall gives no names or emails to plugins.

## How do I share data between people?

A person's notes, files, events and storage are always theirs only: a plugin cannot show them to someone else through the API. For data meant for everyone, use [`holdall.sharedDir()`](/holdall/plugins/server-and-hooks/#data-folder) in server code, or a `global` [setting](/holdall/plugins/manifest/#settings).

## Can I show a notification from the interface?

Yes, `notifications.show` works from interface code too, with the `notifications` permission.

## My widget shows nothing after an update

Reload the page: widgets and pages are loaded once. If it still fails, read the browser console (F12) and the [Holdall log](/holdall/plugins/tooling/#read-the-logs).

## Can a plugin replace a Holdall screen?

Not yet. The `ui:replace` permission is reserved for that. See [Not available yet](/holdall/plugins/overview/#not-available-yet).

## Which license should I use?

Pick one and write it in `license` and in your repository. If you copy the SDK into your plugin, check the SDK's own license in `packages/plugin-sdk/package.json`.

## How do I report a bug in the plugin API?

Open an issue on the [Holdall repository](https://github.com/Toutourina0110/holdall/issues) with the plugin manifest, what you did, and the log lines.
