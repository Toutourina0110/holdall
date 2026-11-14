---
title: Public demo
description: Run a demo instance where visitors try Holdall with throwaway accounts.
---

A demo instance lets people try Holdall without creating an account. Run a **separate** Holdall, with its own data folder, and set:

```
DEMO_MODE=true
DEMO_RESET_MINUTES=60
```

How it behaves:

- Visitors land on `/demo` and get their own account, filled with made-up notes, tasks and events. Nobody sees another visitor's data.
- Each demo account and its files are deleted `DEMO_RESET_MINUTES` after it was created (at least 5).
- Turned off on the server: video downloads, calendar connections and sync, plugin installs. Uploads are limited to 5 MB.
- There is no setup page and no admin account.
- At most 300 demo accounts exist at once, 30 can be opened per minute in total, and one address can open 5 every 10 minutes. Behind a proxy, set `TRUST_PROXY=true` so this limit applies to each visitor.

:::danger
Never turn on `DEMO_MODE` on an instance that holds real data: the sign-in page is replaced by the demo page.
:::

## Free hosting on Render

A demo keeps nothing for long, so a free host without a disk is enough. The repository has a `render.yaml` file that sets everything up.

1. Create an account at https://render.com and connect your GitHub account.
2. **New, Blueprint**, then pick the Holdall repository. Render reads `render.yaml` and creates the `holdall-demo` web service, with a random `APP_SECRET`.
3. Change `APP_URL` in the service's **Environment** if your address is not `https://demo.holdall.site`.
4. In **Settings, Custom Domains**, add your address. At your domain provider, add the `CNAME` record Render shows (for example `demo` pointing to `holdall-demo.onrender.com`).

Free Render services stop after 15 minutes without visits and take about a minute to start again. To keep the demo awake, create a free monitor at https://uptimerobot.com that opens `https://demo.holdall.site/api/health` every 5 minutes. One service running all month stays within Render's free hours.

Render may restart a free service at any time. For a demo this only empties it earlier than planned.
