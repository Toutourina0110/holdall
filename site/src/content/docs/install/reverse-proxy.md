---
title: Reverse proxy
description: Run Holdall behind Cloudflare, Caddy, Nginx or another reverse proxy.
---

Holdall limits sign-in attempts to 5 per minute for each visitor address, and limits how many demo accounts one address can open. Behind a proxy, every request seems to come from the proxy, so Holdall must read the visitor's real address from the headers the proxy adds.

Set `TRUST_PROXY=true` **only** when Holdall can be reached **only** through the proxy. Holdall then reads the visitor's address from `CF-Connecting-IP`, `X-Real-IP` or the last entry of `X-Forwarded-For`.

If the Holdall port is also open to the internet directly, someone could send these headers themselves and get around the limits. Close the port with a firewall, or leave `TRUST_PROXY=false`.

With `TRUST_PROXY=false`, Holdall uses the network address of each connection.

Also set `APP_URL` to the public `https://` address, so links and cookies use it.
