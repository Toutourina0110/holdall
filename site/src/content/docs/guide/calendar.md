---
title: Calendar
description: Day, week, month and agenda views, events, and synced accounts.
---

## Views

Switch between **Day**, **Week**, **Month** and **Agenda**. **Previous**, **Next** and **Today** move through time. In the month view, click a day number to open that day.

Tasks with a due date are shown next to events; click one to open **Tasks**.

## Events

**New event** opens the editor. Set the title, the **calendar**, **All day** or the start and end times, a **location** and **notes**. **Save event** keeps it, **Delete event** removes it.

Events from a read-only calendar, and repeating events, cannot be changed in Holdall. Change them in the service they come from.

## Connect your calendars

Open **Accounts** from the calendar.

- **Connect Google Calendar** and **Connect Outlook** open the provider's sign-in page. They appear only when the admin has set them up (see [Calendar sync](/install/calendar-sync/)).
- **Add iCloud or CalDAV**: for iCloud, use your Apple ID email and an app-specific password created at account.apple.com. For Nextcloud, Fastmail or others, choose **Other CalDAV** and enter the CalDAV address of your server.

For each connected account you can:

- choose which of its calendars to **Show**;
- **Sync now**, instead of waiting up to 15 minutes;
- **Remove** it. Its events are removed from Holdall, not from the service.

Changes sync both ways. When the same event changed on both sides, the most recent change wins and the other one is noted in **Sync history**, with any errors.
