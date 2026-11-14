---
title: Updates
description: How a Holdall server tells you about new versions, and how an admin updates it in one click.
---

Once a day, Holdall checks the latest release on GitHub. When a newer version exists, everyone sees a banner at the top of the page: **Holdall x.y.z is available**, with a link to what is new.

- **Members** only see the banner.
- **Admins** also see how to update: an **Update now** button if a webhook is set, or the command to run on the server.

The check sends one request to `api.github.com` a day and nothing about you. Turn it off with `UPDATE_CHECK=false`. The public demo and the desktop app never show the banner; the desktop app [updates itself](/docs/desktop/install/#update).

## Update without a webhook

On the server, in the `holdall` folder:

```bash
docker compose pull
docker compose up -d
```

## The Update now button

Holdall cannot replace its own container, so the button asks the tool that runs it. Set `UPDATE_WEBHOOK_URL`, and `UPDATE_WEBHOOK_TOKEN` if the tool needs a token. Holdall sends a `GET` request with `Authorization: Bearer <token>`. Only admins can press the button, and the address is never shown in the browser.

### With Coolify

1. In Coolify, **Keys & Tokens**, **API tokens**: create a token with the **deploy** permission.
2. In your Holdall application, **Webhooks**: copy the **Deploy Webhook** address.
3. Set `UPDATE_WEBHOOK_URL` to that address and `UPDATE_WEBHOOK_TOKEN` to the token, then redeploy once.

If you used a **Docker Image** resource, Coolify downloads the new `latest` image when it redeploys. If you build from the repository, it builds the new code.

### With Watchtower

Watchtower updates containers when their image changes. Add it next to Holdall in `docker-compose.yml`:

```yaml
  watchtower:
    image: containrrr/watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      WATCHTOWER_HTTP_API_UPDATE: "true"
      WATCHTOWER_HTTP_API_TOKEN: change-me-to-a-long-random-token
    command: --http-api-update
```

Then in `.env`:

```
UPDATE_WEBHOOK_URL=http://watchtower:8080/v1/update
UPDATE_WEBHOOK_TOKEN=change-me-to-a-long-random-token
```

Run `docker compose up -d`. Watchtower gets access to Docker itself, so keep its port unpublished, as above: only Holdall, on the same Docker network, can reach it.
