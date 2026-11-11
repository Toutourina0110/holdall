# Holdall

Holdall is a self-hosted personal toolbox: notes and tasks, a synced calendar, a video downloader, a file converter and a file manager, extensible with plugins and themes. It runs as a desktop app (Windows, macOS, Linux) or as a Docker image on your own server. Your data stays in one folder you control; notes are plain Markdown files.

**Status:** early development. Notes, tasks, calendar sync (Google, Outlook, iCloud, CalDAV), video downloads, file manager, converter, customizable layout, themes, plugins and the plugin store all work. Expect rough edges.

## Documentation

Everything is on the documentation site: **https://toutourina0110.github.io/holdall/**

- [Install on a server](https://toutourina0110.github.io/holdall/install/configuration/) (Docker, Ubuntu, Coolify)
- [Desktop app](https://toutourina0110.github.io/holdall/desktop/install/)
- [User guide](https://toutourina0110.github.io/holdall/guide/first-steps/)
- [Write plugins and themes](https://toutourina0110.github.io/holdall/plugins/overview/)

The site source is in `site/`.

## Video downloads

Holdall uses [yt-dlp](https://github.com/yt-dlp/yt-dlp). You are responsible for respecting each website's terms of use and copyright when you download content.

## Development

Requirements: Node 26, pnpm 12, and Rust with the Tauri prerequisites for the desktop app.

```powershell
pnpm install
pnpm dev
```

Then open http://localhost:3000. The first visit creates the admin account. Configuration goes in a `.env` file, see `.env.example`. All commands are listed in [Development](https://toutourina0110.github.io/holdall/contributing/development/).

## License

GNU Affero General Public License v3.0 or later. See `LICENSE` and `NOTICE.md`.
