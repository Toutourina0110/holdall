---
title: Releases
description: How a Holdall version is published, and how desktop updates are signed.
---

Pushing a tag like `v0.2.0` runs the release workflow:

- it builds and publishes the Docker image to `ghcr.io/toutourina0110/holdall` (amd64 and arm64);
- it builds the desktop installers for Windows, macOS (Apple Silicon and Intel) and Linux, and attaches them to a draft GitHub release.

Check the draft, then publish it.

## Signed automatic updates

Automatic desktop updates need a signing key that only the maintainer holds. Until it is set up, people update by installing the new version over the old one.

To set it up (maintainer, once), in PowerShell:

```powershell
pnpm tauri signer generate -w "$HOME\.tauri\holdall.key"
```

Then:

1. add the private key and its password as the GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`;
2. put the public key in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

Keep the private key safe: losing it means existing installs can no longer verify updates.
