# Holdall

Holdall is a self-hosted personal toolbox: notes and tasks, a synced calendar, a video downloader, a file converter and a file manager, extensible with plugins and themes. It runs as a desktop app (Windows, macOS, Linux) or as a Docker image on your own server. Your data stays in one folder you control; notes are plain Markdown files.

**Status:** early development. Notes, tasks, calendar sync (Google, Outlook, iCloud, CalDAV), video downloads, file manager, converter, customizable layout, themes, plugins and the plugin store all work. Expect rough edges.

## Install

- **Server (Docker, Ubuntu, Coolify):** see [docs/DEPLOY.md](docs/DEPLOY.md).
- **Desktop:** download the installer from the releases page, or build it yourself (see docs/DEPLOY.md).

## Demo

A public demo instance is coming soon. To run your own, see the "Public demo" section of [docs/DEPLOY.md](docs/DEPLOY.md).

## Video downloads

Holdall uses [yt-dlp](https://github.com/yt-dlp/yt-dlp). You are responsible for respecting each website's terms of use and copyright when you download content.

## Development

Requirements: Node 26, pnpm 12, and Rust with the Tauri prerequisites for the desktop app.

```powershell
pnpm install
pnpm db:migrate
pnpm dev
```

Then open http://localhost:3000. The first visit creates the admin account.

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the app in development |
| `pnpm build` | Production build (standalone server bundle) |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm e2e` | End to end tests (Playwright) |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm desktop:dev` | Run the desktop app in development |
| `pnpm desktop:build` | Build the desktop installer for the current OS |

Configuration goes in a `.env` file, see `.env.example`.

## Plugins

Plugins can add pages, Today widgets and reactions to events, with permissions you approve one by one. Admins install them from the store or from an archive. See [docs/PLUGINS.md](docs/PLUGINS.md), the SDK in `packages/plugin-sdk` and the examples in `examples/plugins`.

## License

GNU Affero General Public License v3.0 or later. See `LICENSE` and `NOTICE.md`.
