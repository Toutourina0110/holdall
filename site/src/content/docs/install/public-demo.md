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
