---
title: Build the desktop app
description: Build the Holdall installers yourself from the source code.
---

Requirements:

- Node 26 and pnpm 12;
- Rust;
- the Tauri prerequisites for your system: https://v2.tauri.app/start/prerequisites/

In PowerShell, at the project root:

```powershell
pnpm install
pnpm desktop:build
```

The build downloads the official Node binary for your system, checks its checksum, and bundles it with the app. Installers are written to `src-tauri\target\release\bundle`.

To run the desktop app in development, with live reload:

```powershell
pnpm desktop:dev
```

The build also signs the update files, so it needs the signing key in the environment. Without the maintainer's key, turn the update files off for your own build: in `src-tauri/tauri.conf.json`, set `bundle.createUpdaterArtifacts` to `false`. Your build then works normally, but does not update itself.

Installers are built for the system you build on. The release workflow builds all of them on GitHub (see [Releases](/docs/contributing/releases/)).
