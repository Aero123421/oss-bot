# oss-bot

Open-source on-prem agent platform (P0 scaffold).

## Stack

Node 22 + TypeScript + Hono + SQLite + Docker Compose. Shared token gate (`OSS_BOT_TOKEN`). No Postgres / Redis.

## Quick start

```bash
cp .env.example .env
# set OSS_BOT_TOKEN to a long random string
docker compose up --build
```

```bash
curl -s localhost:3000/healthz
curl -s -H "Authorization: Bearer $OSS_BOT_TOKEN" localhost:3000/api/v1/me
```

Local without Docker:

```bash
cp .env.example .env
npm install
npm run doctor
npm run dev
```

## Doctor

`npm run doctor` — host / docker / sqlite / token checks.  
`npm run doctor:ci` — CI mode with `--strict`.

## Risks

See `RISKS.md`. Do not `docker compose down -v` in production (SQLite data loss).
