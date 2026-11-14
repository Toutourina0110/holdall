---
title: Development
description: Run Holdall from source and the commands you need to work on it.
---

Requirements: Node 26, pnpm 12, and Rust with the Tauri prerequisites for the desktop app.

In PowerShell, at the project root:

```powershell
pnpm install
pnpm dev
```

`pnpm dev` applies the database migrations, then starts the app. Open http://localhost:3000; the first visit creates the admin account. Settings go in a `.env` file, see `.env.example` and [Settings](/docs/install/configuration/).

## Commands

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
| `pnpm docs:dev` | Run this documentation site locally |
| `pnpm docs:build` | Build this documentation site |

## Project layout

| Folder | Content |
|---|---|
| `src/app` | Pages and API routes (Next.js App Router) |
| `src/core` | Accounts, database, jobs, layout, themes, plugin host, security |
| `src/modules` | Built-in modules, written with the plugin API |
| `packages/plugin-sdk` | The plugin SDK |
| `examples` | Example plugins and the registry template |
| `src-tauri` | The desktop app |
| `site` | This documentation site |

## Website and documentation

The `site` folder builds one website: the home page at `holdall.site` (`site/src/pages/index.astro`) and this documentation under `holdall.site/docs/` (Markdown files in `site/src/content/docs/docs`). Every push to `main` that changes `site/` publishes it to GitHub Pages.

To set it up once:

1. The repository must be public (GitHub Pages is not free for private repositories).
2. In **Settings, Pages**, set **Source** to **GitHub Actions**, then **Custom domain** to `holdall.site`, and turn on **Enforce HTTPS** once it is offered.
3. In the DNS of `holdall.site`, point the root of the domain to GitHub Pages: four `A` records for `@` with `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`. With Cloudflare, leave them **DNS only**.
4. The file `site/public/CNAME` keeps the domain on every publish.

Old links to `docs.holdall.site` keep working with a redirect to `holdall.site/docs/` set up in Cloudflare (a proxied `docs` record and a redirect rule).
