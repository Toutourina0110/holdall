# Deploying Holdall

Holdall runs in two ways from the same code:

- **Server**: a Docker image you run on your own machine or server (Ubuntu, Coolify, any Docker host). You open it in a browser from a computer or a phone.
- **Desktop**: an app for Windows, macOS and Linux that runs everything locally.

All your data lives in one folder (`DATA_DIR`): the database `holdall.db`, your notes as `.md` files, your files and downloads. Back up this folder and you have backed up everything.

## 1. Settings

Copy `.env.example` to `.env` and fill it in. The two settings you must set on a server:

| Variable | What to put |
|---|---|
| `APP_URL` | The address people type to reach Holdall, for example `https://holdall.example.com`. |
| `APP_SECRET` | A random string of at least 32 characters. It signs sessions and encrypts saved passwords and tokens. Never change it after the first start, or saved calendar connections stop working. |

Generate a secret:

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

On a Linux server:

```bash
openssl rand -base64 48
```

Holdall refuses to start when a setting is invalid, and prints which one and why.

## 2. Docker on Ubuntu

These commands run **on the server**, in a terminal (bash).

1. Install Docker by following the official guide: https://docs.docker.com/engine/install/ubuntu/
2. Get Holdall:

   ```bash
   git clone https://github.com/Toutourina0110/holdall.git
   cd holdall
   cp .env.example .env
   nano .env
   ```

3. Start it:

   ```bash
   docker compose up -d --build
   ```

4. Open `http://<server address>:3000`. The first visit shows the setup page that creates the admin account. That page only works while no account exists.

The image contains Node, ffmpeg and yt-dlp (verified with its official checksum), runs as a non-root user, keeps data in the `holdall-data` volume mounted on `/data`, and reports its health on `/api/health`.

### Update

```bash
cd holdall
git pull
docker compose up -d --build
```

Database migrations run automatically when the container starts.

### Back up

```bash
docker compose stop
docker run --rm -v holdall_holdall-data:/data -v "$PWD":/backup alpine tar czf /backup/holdall-backup.tgz -C /data .
docker compose start
```

## 3. Coolify

1. In Coolify, create a new resource, choose **Public Repository** (or your fork) and paste the repository address.
2. Build pack: **Dockerfile**. Port: **3000**.
3. In **Environment Variables**, add `APP_URL` (the domain Coolify gives you or your own) and `APP_SECRET`. Add `TRUST_PROXY=true`, because Coolify puts a proxy in front of the app.
4. In **Storages**, add a persistent volume mounted on `/data`.
5. In **Domains**, set your domain. Coolify handles HTTPS.
6. Deploy. Coolify uses the image health check on `/api/health`.

## 4. Behind Cloudflare or another reverse proxy

Set `TRUST_PROXY=true` only when Holdall can be reached **only** through the proxy. Holdall then reads the visitor's address from `CF-Connecting-IP`, `X-Real-IP` or `X-Forwarded-For` to limit sign-in attempts per person. If the port is also open to the internet directly, someone could fake these headers, so close it (firewall) or leave `TRUST_PROXY=false`.

With `TRUST_PROXY=false`, Holdall uses the real network address of each connection.

Sign-in is limited to 5 attempts per minute per address.

## 5. Desktop app

Download the installer for your system from the GitHub releases page:

- Windows: `.msi` or `-setup.exe`
- macOS: `.dmg`
- Linux: `.AppImage` or `.deb`

The desktop app starts a private Holdall server on `127.0.0.1` with a random port and a secret launch token, so no website or other program on your computer can use it. A local account is created on first start and you are signed in automatically. The login screen only appears if you add more accounts.

Data folder:

- Windows: `%APPDATA%\io.github.toutourina0110.holdall`
- macOS: `~/Library/Application Support/io.github.toutourina0110.holdall`
- Linux: `~/.local/share/io.github.toutourina0110.holdall`

Logs are in the `logs` folder inside it.

### Build the desktop app yourself

Requirements: Node 26, pnpm, Rust, and the Tauri prerequisites for your system (https://v2.tauri.app/start/prerequisites/). In PowerShell, at the project root:

```powershell
pnpm install
pnpm desktop:build
```

The build downloads the official Node binary for your system, checks its checksum, and bundles it with the app. Installers are written to `src-tauri\target\release\bundle`.

### Signed automatic updates

Automatic desktop updates need a signing key that only the maintainer holds. Until it is set up, update by installing the new version over the old one; your data is kept.

To set it up (maintainer, once):

```powershell
pnpm tauri signer generate -w "$HOME\.tauri\holdall.key"
```

Then add the private key and its password as GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and put the public key in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

## 6. Releases

Pushing a tag like `v0.2.0` runs the release workflow:

- builds and publishes the Docker image to `ghcr.io/toutourina0110/holdall` (amd64 and arm64);
- builds the desktop installers for Windows, macOS (Apple Silicon and Intel) and Linux, and attaches them to a draft GitHub release.

## 7. Troubleshooting

| Symptom | What to do |
|---|---|
| The container stops right after starting | Run `docker compose logs holdall`. An invalid setting is named in the first lines. |
| "Too many attempts" when signing in | Wait one minute. Behind a proxy, check `TRUST_PROXY` (see section 4). |
| The desktop app shows "Holdall could not start" | Open the `logs` folder in the data folder and read `server.log`. |
