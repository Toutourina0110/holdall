---
title: Install the desktop app
description: Install Holdall on Windows, macOS or Linux, where it keeps its data and how to update it.
---

Download the installer for your system from the [GitHub releases page](https://github.com/Toutourina0110/holdall/releases):

| System | File |
|---|---|
| Windows | `.msi` or `-setup.exe` |
| macOS (Apple Silicon or Intel) | `.dmg` |
| Linux | `.AppImage` or `.deb` |

Open it and follow the installer. There is nothing to configure.

## How it works

The desktop app starts a private Holdall server on `127.0.0.1`, with a random port and a secret launch token, so no website or other program on your computer can use it. A local account is created on first start and you are signed in automatically. The sign-in screen only appears if you add more accounts.

yt-dlp is installed and kept up to date by the app. On Windows, ffmpeg is installed too. On macOS and Linux, install ffmpeg with your package manager (`brew install ffmpeg`, `sudo apt install ffmpeg`).

Google and Outlook calendars need a server instance. iCloud and CalDAV work on the desktop (see [Calendar sync](/install/calendar-sync/)).

## Data folder

| System | Folder |
|---|---|
| Windows | `%APPDATA%\io.github.toutourina0110.holdall` |
| macOS | `~/Library/Application Support/io.github.toutourina0110.holdall` |
| Linux | `~/.local/share/io.github.toutourina0110.holdall` |

Logs are in the `logs` folder inside it. To back up, copy the whole folder while the app is closed.

## Update

Until signed automatic updates are turned on, install the new version over the old one. Your data is kept.
