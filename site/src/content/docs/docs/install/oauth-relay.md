---
title: Sign-in relay
description: How Holdall connects Google Calendar and Outlook without your own OAuth apps, what the relay sees, and how to turn it off or host your own.
---

Google and Microsoft only open their sign-in pages for registered apps, and each app has a fixed return address. A self-hosted Holdall can live at any address, so without help every admin would have to register their own apps. The sign-in relay is that help: one registered app, run by the Holdall project at `https://auth.holdall.site`, that hands the access back to your Holdall.

It is on by default, on servers and in the desktop app. If you set up [your own apps](/docs/install/calendar-sync/#your-own-google-app-optional), they are used instead.

## What happens when someone connects

1. In **Calendar, Accounts**, the person clicks **Connect Google Calendar**. Holdall makes a one-time code and a one-time key, keeps them in memory for 10 minutes, and sends the browser to the relay.
2. The relay shows the address of the Holdall that asked, so nobody can trick a person into sending their calendar to someone else's Holdall. The person clicks **Continue**.
3. Google or Microsoft ask the person to allow access to their calendar.
4. The relay receives the access, encrypts it with the one-time key and sends the browser back to Holdall.
5. Holdall checks the one-time code, checks that the same person is signed in, decrypts the access and saves it encrypted with `APP_SECRET`.

When the access expires, about once an hour, Holdall asks the relay to renew it.

## What the relay sees and keeps

- It sees the address of your Holdall and, for a moment, the calendar access while passing it on.
- It never reads your events: calendar data goes from Google or Microsoft to your Holdall directly.
- It keeps nothing: no database, no files. Its log only notes errors.

The full details are on the [privacy page](/privacy/), and the code is `scripts/relay.ts` in the repository.

## Turn it off

Set this in `.env`, then restart Holdall:

```
OAUTH_RELAY_URL=off
```

Google and Outlook buttons then only appear for providers with your own app. Accounts already connected through the relay stop renewing their access: connect them again with your own app.

## Host your own relay

The relay ships in the same Docker image as Holdall. It is a small program of about 50 MB of memory that you start with `node /app/relay.mjs` instead of the normal command.

1. Create a Google app and a Microsoft app as in [Calendar sync](/docs/install/calendar-sync/#your-own-google-app-optional), with these return addresses (using your relay address):

   ```
   https://auth.example.com/relay/google/callback
   https://auth.example.com/relay/microsoft/callback
   ```

2. Run the image with the relay command and these variables:

   | Variable | Value |
   |---|---|
   | `RELAY_PUBLIC_URL` | The public address of the relay, like `https://auth.example.com`. |
   | `RELAY_SECRET` | A random string of at least 32 characters. Changing it cancels sign-ins in progress, nothing else. |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Your Google app. Leave empty to skip Google. |
   | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | Your Microsoft app. Tenant `common` by default. |
   | `PORT` | Port to listen on, `3000` by default. |
   | `TRUST_PROXY`, `TRUST_PROXY_HEADER` | As for Holdall, see [Reverse proxy](/docs/install/reverse-proxy/). Used for the rate limits. |

   With Docker Compose:

   ```yaml
   services:
     relay:
       image: ghcr.io/toutourina0110/holdall:latest
       command: ["node", "/app/relay.mjs"]
       restart: unless-stopped
       ports:
         - "3000:3000"
       environment:
         RELAY_PUBLIC_URL: https://auth.example.com
         RELAY_SECRET: change-me-to-a-long-random-string-of-32-characters
         GOOGLE_CLIENT_ID: your-google-client-id
         GOOGLE_CLIENT_SECRET: your-google-client-secret
         MICROSOFT_CLIENT_ID: your-microsoft-client-id
         MICROSOFT_CLIENT_SECRET: your-microsoft-client-secret
   ```

   With Coolify: add a **Docker Image** resource with `ghcr.io/toutourina0110/holdall:latest`, set the **Custom Start Command** (or **Start Command**) to `node /app/relay.mjs`, the port to `3000`, the domain to your relay address, and the variables above. No volume is needed.

3. Open `https://auth.example.com/api/health`. It answers `{"status":"ok","providers":["google","microsoft"]}`.
4. On each Holdall that should use it, set `OAUTH_RELAY_URL=https://auth.example.com` and restart.

The relay only accepts return addresses ending in `/api/calendar/oauth/google/callback` or `/api/calendar/oauth/microsoft/callback`, over `https`, or `http` on `127.0.0.1` and `localhost` for the desktop app.
