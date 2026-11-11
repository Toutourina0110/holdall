---
title: Calendar sync
description: Let people connect Google Calendar, Outlook, iCloud and CalDAV calendars.
---

Every account has a local Holdall calendar. People can also connect their own calendars from **Calendar, Accounts**. Changes sync both ways every 15 minutes, and right away with **Sync now**. When the same event changed on both sides, the most recent change wins and the other one is written in the sync history.

Saved passwords and tokens are encrypted with `APP_SECRET`.

## iCloud and other CalDAV servers

Nothing to set up on the server. Each person adds their account with an app password:

- iCloud: create an app-specific password at https://account.apple.com (**Sign-In and Security, App-Specific Passwords**).
- Nextcloud, Fastmail and others: use the CalDAV address of the server and an app password.

Members can only reach public `https` servers. An admin can also add a CalDAV server on the local network, for example `http://192.168.1.10:5232`.

## Google Calendar (admin, once)

1. Open https://console.cloud.google.com and create a project.
2. In **APIs & Services, Library**, enable **Google Calendar API**.
3. In **OAuth consent screen**, choose **External**, fill in the app name and your email, and add the scope `https://www.googleapis.com/auth/calendar`. While the app is in testing, add each person who will connect as a test user.
4. In **Credentials, Create credentials, OAuth client ID**, choose **Web application** and add this authorized redirect URI (with your `APP_URL`):

   ```
   https://holdall.example.com/api/calendar/oauth/google/callback
   ```

5. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart Holdall.

## Outlook and Microsoft 365 (admin, once)

1. Open https://entra.microsoft.com, then **App registrations, New registration**.
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
3. Redirect URI: platform **Web**, value `https://holdall.example.com/api/calendar/oauth/microsoft/callback` (with your `APP_URL`).
4. In **API permissions**, add the Microsoft Graph delegated permissions `Calendars.ReadWrite`, `User.Read` and `offline_access`.
5. In **Certificates & secrets**, create a client secret and copy its **Value**.
6. Set `MICROSOFT_CLIENT_ID` (the Application ID) and `MICROSOFT_CLIENT_SECRET`. Keep `MICROSOFT_TENANT_ID=common` unless you want to allow only one organization. Restart Holdall.

When a provider is not set up, the Accounts page says so and hides its button.

## Desktop app

Google and Microsoft do not allow signing in from inside an embedded app window, so the desktop app offers iCloud and CalDAV only. To sync Google or Outlook, use a server instance.
