# oss-bot

On-prem agent platform (P0). **Node 22 + TypeScript + Hono + SQLite + Docker bot runtime.** No Postgres / Redis.

## Quick start

```bash
cp .env.example .env
# set OSS_BOT_TOKEN to a long random string
docker compose up --build
```

Bot VM control (**DEV** — mounts docker.sock):

```bash
export DOCKER_GID="$(getent group docker | cut -d: -f3)"   # required, must not be 0
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

`DOCKER_HOST` is set only by the dev overlay, not base compose. Never combine sock overlay with `NODE_ENV=production`.

```bash
curl -s localhost:3000/healthz
curl -s -H "Authorization: Bearer $OSS_BOT_TOKEN" localhost:3000/api/v1/me
```

Local without Docker:

```bash
npm install
npm run doctor
npm run dev
```

## Doctor

`npm run doctor` — host / docker / sqlite / token / bot-runtime checks.  
`npm run doctor:ci` — CI mode with `--strict`.

## Risks

See `RISKS.md`. Do not `docker compose down -v` in production (SQLite data loss). Do not use `docker-compose.dev.yml` in production.

## Dependencies

Always commit `package-lock.json`. Install with `npm ci` (not `npm install`) so Docker/CI match local.

## /healthz

Success: `{ ok, db, schema_version }`. Failure: `{ ok: false, error: "unavailable" }` (details only in server logs).

