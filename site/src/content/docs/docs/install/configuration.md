---
title: Settings
description: The environment variables that configure a Holdall server.
---

Holdall reads its settings from environment variables. With Docker, put them in a `.env` file next to `docker-compose.yml`: copy `.env.example` to `.env` and fill it in. With Coolify, add them in the **Environment Variables** tab.

Holdall refuses to start when a setting is invalid, and prints which one and why.

## Required on a server

| Variable | What to put |
|---|---|
| `APP_URL` | The address people type to reach Holdall, for example `https://holdall.example.com`. |
| `APP_SECRET` | A random string of at least 32 characters. It signs sessions and encrypts saved passwords and tokens. Never change it after the first start, or saved calendar connections stop working. |

Generate a secret in PowerShell:

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

Or on a Linux server:

```bash
openssl rand -base64 48
```

## All settings

| Variable | Default | Meaning |
|---|---|---|
| `APP_URL` | `http://localhost:3000` | Public address of the instance, used for links and cookies. |
| `APP_SECRET` | none | Secret for sessions and encryption. See above. |
| `DATA_DIR` | `./data` in development, `/data` in Docker | Where the database and every user file are stored. |
| `PORT` | `3000` | Port the server listens on. |
| `HOLDALL_TARGET` | `server` | `server` for Docker and browsers, `desktop` for the desktop app. |
| `ALLOW_REGISTRATION` | `false` | Let anyone who reaches the instance create an account. When `false`, people join with an invitation link. An admin can also change this in **Admin**. |
| `TRUST_PROXY` | `false` | Set to `true` only behind a reverse proxy. See [Reverse proxy](/docs/install/reverse-proxy/). |
| `TRUST_PROXY_HEADER` | `auto` | Which header holds the visitor's address behind the proxy. See [Reverse proxy](/docs/install/reverse-proxy/). |
| `DEMO_MODE` | `false` | Public demo with throwaway accounts. Never on real data. See [Public demo](/docs/install/public-demo/). |
| `DEMO_RESET_MINUTES` | `60` | Lifetime of a demo account, at least 5. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | empty | Google Calendar sync. See [Calendar sync](/docs/install/calendar-sync/). |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | empty, empty, `common` | Outlook and Microsoft 365 sync. |
| `ALLOW_UNSAFE_PLUGINS` | `false` on a server, `true` on the desktop app | Allow plugins with dangerous permissions (`system`, `fs:host`, `process:spawn`, `network:direct`). Such a plugin can read every account's data. See [Permissions](/docs/plugins/permissions/#dangerous-permissions). |
| `PLUGIN_REGISTRY_URL` | official registry | Address of the plugin store index, if you use a mirror. |
| `MAX_CONCURRENT_JOBS` | `2` | Background jobs (downloads, conversions, sync) that run at the same time. |
| `MAX_UPLOAD_MB` | `500` | Largest file a person can upload. |
| `YTDLP_AUTO_UPDATE` | `true` | Keep yt-dlp up to date on the desktop app. |
| `YTDLP_PATH`, `FFMPEG_PATH` | empty | Paths to yt-dlp and ffmpeg. The Docker image sets them. |

## The first account

The first visit to a new instance shows a setup page that creates the **admin** account. That page only works while no account exists. After that, the admin invites other people from **Admin** (see [First steps](/docs/guide/first-steps/)).
