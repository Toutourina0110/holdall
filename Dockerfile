FROM node:26-trixie-slim AS build
ARG TARGETARCH
ARG YTDLP_VERSION=2026.10.26
WORKDIR /src
RUN npm install -g pnpm@12.9.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
RUN if [ "$TARGETARCH" = "arm64" ]; then asset=yt-dlp_linux_aarch64; else asset=yt-dlp_linux; fi \
 && node scripts/fetch-ytdlp.mjs "$YTDLP_VERSION" "$asset" /out/yt-dlp

FROM node:26-trixie-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data \
 && chown node:node /data
COPY --from=build /out/yt-dlp /usr/local/bin/yt-dlp
COPY --from=build --chown=node:node /src/.next/standalone /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOLDALL_TARGET=server \
    DATA_DIR=/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    YTDLP_PATH=/usr/local/bin/yt-dlp \
    FFMPEG_PATH=/usr/bin/ffmpeg
WORKDIR /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "/app/start.mjs"]
