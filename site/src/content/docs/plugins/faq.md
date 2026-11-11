---
title: Plugin FAQ
description: Common questions about writing Holdall plugins.
---

## Do I need server code?

No. Many plugins are only a widget or a page that calls the API. Add server code when you must react to something (a note saved, a download finished) or answer a filter.

## Can my interface code use `fetch()` or load a library from a CDN?

Yes. Your interface can load scripts, styles, fonts, images and videos from any site, embed other sites, and call web APIs that allow CORS. It only never sees the Holdall session. For APIs without CORS, or with a secret key, call them from your server code.

## Can I embed a video or a live stream?

Yes. Use the player the site gives you (an `<iframe>` or its script). Fullscreen and autoplay are allowed.

## Can my server code use npm packages?

Yes, if you bundle them into your server file. Packages that need native addons, write files, start programs or open network connections will not work in the sandbox.

## Can my server code run on a timer?

Not yet. Server code runs when Holdall calls one of your hooks. To refresh data regularly, do it from your widget or page when it opens, or when a hook fires.

## Where do I keep settings?

In storage, with a form on your page: `storage.set("settings", {...})`. Each person has their own.

## How do I know who is using the plugin?

You don't need to: every call already acts for the right person. `context.userId` exists in server code, but Holdall gives no names or emails to plugins.

## How do I share data between people?

You can't. Storage, notes, files and events are always those of the person using the plugin. This is on purpose.

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
