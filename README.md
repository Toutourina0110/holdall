# Holdall

Holdall is a self-hosted personal toolbox: notes and tasks, a synced calendar, a video downloader, a file converter and a file manager, extensible with plugins and themes. It runs as a desktop app (Windows, macOS, Linux) or as a Docker image on your own server. Your data stays in one folder you control; notes are plain Markdown files.

**Status:** early development. Notes, tasks, calendar sync (Google, Outlook, iCloud, CalDAV), video downloads, file manager, converter, customizable layout, themes, plugins and the plugin store all work. Expect rough edges.

## Try it

A public demo runs at **https://demo.holdall.site**: each visitor gets their own account with made-up data, deleted after an hour.

## Documentation

Everything is on the documentation site: **https://docs.holdall.site/**

- [Install on a server](https://docs.holdall.site/install/configuration/) (Docker, Ubuntu, Coolify)
- [Desktop app](https://docs.holdall.site/desktop/install/)
- [User guide](https://docs.holdall.site/guide/first-steps/)
- [Write plugins and themes](https://docs.holdall.site/plugins/overview/)

The site source is in `site/`.

## Video downloads

Holdall uses [yt-dlp](https://github.com/yt-dlp/yt-dlp). You are responsible for respecting each website's terms of use and copyright when you download content.

## Development

Requirements: Node 26, pnpm 12, and Rust with the Tauri prerequisites for the desktop app.

```powershell
pnpm install
pnpm dev
```

Then open http://localhost:3000. The first visit creates the admin account. Configuration goes in a `.env` file, see `.env.example`. All commands are listed in [Development](https://docs.holdall.site/contributing/development/).

## License

GNU Affero General Public License v3.0 or later. See `LICENSE` and `NOTICE.md`.
