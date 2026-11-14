---
title: Reverse proxy
description: Run Holdall behind Cloudflare, Caddy, Nginx or another reverse proxy.
---

Holdall limits sign-in attempts to 5 per minute for each visitor address, and limits how many demo accounts one address can open. Behind a proxy, every request seems to come from the proxy, so Holdall must read the visitor's real address from the headers the proxy adds.

Set `TRUST_PROXY=true` **only** when Holdall can be reached **only** through the proxy. Then tell Holdall which header your proxy sets, with `TRUST_PROXY_HEADER`:

| Proxy | `TRUST_PROXY_HEADER` |
|---|---|
| Cloudflare (proxied DNS or Tunnel), and Render, which runs behind Cloudflare | `cf-connecting-ip` |
| Nginx with `proxy_set_header X-Real-IP $remote_addr` | `x-real-ip` |
| Coolify, Caddy, Traefik and most self-hosted proxies | `x-forwarded-for` (Holdall reads its last entry, the one the proxy added) |

Pick the header your proxy always writes itself. A visitor can send any other header with a made-up address. The default, `auto`, tries the three in that order and is only safe if your proxy overwrites all of them.

If the Holdall port is also open to the internet directly, someone could send these headers themselves and get around the limits. Close the port with a firewall, or leave `TRUST_PROXY=false`.

With `TRUST_PROXY=false`, Holdall uses the network address of each connection.

Also set `APP_URL` to the public `https://` address, so links and cookies use it.
