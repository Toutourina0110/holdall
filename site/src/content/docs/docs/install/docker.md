---
title: Docker on Ubuntu
description: Run Holdall with Docker Compose on an Ubuntu server, update it and back it up.
---

These commands run **on the server**, in a terminal (bash). Holdall is published as a ready-made image, `ghcr.io/toutourina0110/holdall`, for `amd64` and `arm64` servers.

## Install

1. Install Docker by following the official guide: https://docs.docker.com/engine/install/ubuntu/
2. Download the two files Holdall needs, and write your settings:

   ```bash
   mkdir holdall && cd holdall
   curl -fsSLO https://raw.githubusercontent.com/Toutourina0110/holdall/main/docker-compose.yml
   curl -fsSL https://raw.githubusercontent.com/Toutourina0110/holdall/main/.env.example -o .env
   nano .env
   ```

   Set at least `APP_URL` and `APP_SECRET` (see [Settings](/docs/install/configuration/)).

3. Start it:

   ```bash
   docker compose up -d
   ```

4. Open `http://<server address>:3000`. The first visit shows the setup page that creates the admin account.

The image contains Node, ffmpeg and yt-dlp (verified with its official checksum), runs as a non-root user, keeps data in the `holdall-data` volume mounted on `/data`, and reports its health on `/api/health`.

To reach Holdall with a domain name and HTTPS, put it behind a reverse proxy such as Caddy, Nginx or a Cloudflare Tunnel, then read [Reverse proxy](/docs/install/reverse-proxy/).

## Update

In the `holdall` folder:

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically when the container starts. yt-dlp and ffmpeg are updated with the image, so update regularly: video websites change often.

To stay on one version instead of the latest, replace `latest` in `docker-compose.yml` with a version number, for example `ghcr.io/toutourina0110/holdall:0.1.0`.

## Back up

Everything is in the `holdall-data` volume. To save it to `holdall-backup.tgz` in the current folder:

```bash
docker compose stop
docker run --rm -v holdall_holdall-data:/data -v "$PWD":/backup alpine tar czf /backup/holdall-backup.tgz -C /data .
docker compose start
```

To restore, stop Holdall, extract the archive into the volume the same way (`tar xzf /backup/holdall-backup.tgz -C /data`), then start it again.

## Build the image yourself

To run your own changes, clone the repository and build:

```bash
git clone https://github.com/Toutourina0110/holdall.git
cd holdall
docker build -t holdall:local .
```

Then use `image: holdall:local` in `docker-compose.yml`.
