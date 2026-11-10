# Holdall

Holdall is a self-hosted personal toolbox: notes and tasks, a synced calendar, a video downloader, a file converter and a file manager, extensible with plugins and themes. It runs as a desktop app (Windows, macOS, Linux) or as a Docker image on your own server.

**Status:** phase 0, project setup. Nothing is usable yet.

## Development

Requirements: Node 26, pnpm 12, and Rust with the Tauri prerequisites for the desktop app.

```powershell
pnpm install
pnpm db:migrate
pnpm dev
```

Then open http://localhost:3000.

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the app in development |
| `pnpm build` | Production build (standalone server) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm e2e` | End to end tests (Playwright) |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm desktop:dev` | Run the desktop app in development |
| `pnpm desktop:build` | Build the desktop installer for the current OS |

Configuration goes in a `.env` file, see `.env.example`.

## License

GNU Affero General Public License v3.0 or later. See `LICENSE` and `NOTICE.md`.
