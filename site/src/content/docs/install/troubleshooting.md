---
title: Troubleshooting
description: Common problems when running Holdall and how to fix them.
---

| Symptom | What to do |
|---|---|
| The container stops right after starting | Run `docker compose logs holdall`. An invalid setting is named in the first lines. |
| "Too many attempts" when signing in | Wait one minute. Behind a proxy, check `TRUST_PROXY` (see [Reverse proxy](/holdall/install/reverse-proxy/)). |
| Calendar connections stopped working after a restart | `APP_SECRET` changed. Put the old value back, or remove the accounts and add them again. |
| Google or Outlook buttons are missing on the Accounts page | The provider is not set up on this server. See [Calendar sync](/holdall/install/calendar-sync/). |
| A video download fails on a site that used to work | yt-dlp is out of date. Update the Docker image, or use **Install or update** in Downloads on the desktop app. |
| The plugin store shows an error | The registry could not be reached. Check that the server can open `https://raw.githubusercontent.com`, or check your `PLUGIN_REGISTRY_URL`. |
| The desktop app shows "Holdall could not start" | Open the `logs` folder inside the data folder and read `server.log`. See [Desktop app](/holdall/desktop/install/). |
