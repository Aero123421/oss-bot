# syntax=docker/dockerfile:1.7
# oss-bot API — Node 22 + Hono + SQLite（better-sqlite3 は native build が必要）

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -u 10001 appuser \
  && mkdir -p /app/data && chown -R appuser:appuser /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY --from=build --chown=appuser:appuser /app/dist ./dist
USER appuser
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=20s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
