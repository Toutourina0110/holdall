---
title: Coolify
description: Deploy Holdall on Coolify from its Git repository.
---

1. In Coolify, create a new resource, choose **Public Repository** (or your fork) and paste the repository address.
2. Build pack: **Dockerfile**. Port: **3000**.
3. In **Environment Variables**, add:
   - `APP_URL`: the domain Coolify gives you, or your own;
   - `APP_SECRET`: a random string of at least 32 characters (see [Settings](/docs/install/configuration/));
   - `TRUST_PROXY=true` and `TRUST_PROXY_HEADER=x-forwarded-for`, because Coolify puts a proxy in front of the app.
4. In **Storages**, add a persistent volume mounted on `/data`. Without it, your data is lost at the next deploy.
5. In **Domains**, set your domain. Coolify handles HTTPS.
6. Deploy. Coolify uses the image health check on `/api/health`.

To update, redeploy. Database migrations run when the container starts.
