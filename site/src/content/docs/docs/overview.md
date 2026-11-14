---
title: Overview
description: What Holdall is, the two ways to run it, and where your data lives.
---

Holdall is a self-hosted personal toolbox. One app gives you:

- **Notes** in plain Markdown files, with folders, tags, links between notes and history.
- **Tasks** with lists, due dates, priorities, labels and subtasks.
- **A calendar** that syncs both ways with Google Calendar, Outlook, iCloud and any CalDAV server.
- **A video downloader** built on yt-dlp, for single videos, playlists and channels.
- **A file manager** and **a converter** for images, audio and video.
- **Plugins and themes** that you approve one permission at a time.

Every screen can be rearranged and restyled, and the light and dark themes can be replaced by your own.

## Two ways to run it

Holdall is built from one codebase in two forms:

| Form | For | How you open it |
|---|---|---|
| **Server** | A home server, a VPS, Coolify or any Docker host. Several people can have an account. | In a browser, from a computer or a phone. |
| **Desktop** | One person on Windows, macOS or Linux. Everything runs on that computer. | As a normal app. |

Both forms have the same features, except Google and Outlook calendar sync, which need a server (see [Calendar sync](/docs/install/calendar-sync/)).

## Your data

Everything lives in one folder, called the data folder (`DATA_DIR`):

- `holdall.db`, the database (accounts, tasks, events, settings);
- your notes, as `.md` files you can open with any editor;
- your files, downloads and conversions;
- installed plugins, their settings and their data.

Back up this folder and you have backed up everything. Each person's notes and files are kept in their own subfolder, and nobody can open another person's data.

## License

Holdall is free software under the GNU Affero General Public License v3.0 or later. The source code is on [GitHub](https://github.com/Toutourina0110/holdall).
