# oss-bot

On-prem agent chat (AI版Slack). **Node 22 + TypeScript + Hono + SQLite + Docker runtime.** No Postgres / Redis.

Acceptance: [`docs/WOW.md`](docs/WOW.md). 日本語: [`README.ja.md`](README.ja.md).

## Quick start（README → localhost → 窓口）

```bash
cp .env.example .env
# set OSS_BOT_TOKEN to a long random string (required)
docker compose up --build
```

```bash
curl -s localhost:3000/healthz
curl -s -H "Authorization: Bearer $OSS_BOT_TOKEN" localhost:3000/api/v1/me
```

**Chat UI:** open **http://localhost:8080** — nginx serves `web/` and proxies `/api` + `/ws` to the API (same-origin).

- Enter the token in AuthGate (not re-displayed)
- Default landing: **参謀（窓口）DM** — send one message there (WOW #1)
- Demo empty AuthGate: `?auth=0` (must reject when empty — WOW 付帯 A1)

Stop: `docker compose down` (keeps SQLite volume). Do **not** use `down -v` unless you mean to wipe data.

### UI-only dev（optional）

```bash
cd web && npm i && npm run dev
```

Vite at http://localhost:5173 (proxies `/api` + `/ws` → `http://127.0.0.1:3000`). Prefer **:8080** via compose for the documented path.

### Dev overlay（Docker sock + CredBridge RO）

```bash
export DOCKER_GID="$(getent group docker | cut -d: -f3)"   # required, not 0
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Doctor（失敗したら）

```bash
npm run doctor          # host / docker / sqlite / token / CredBridge paths
npm run doctor:ci       # CI: --strict
```

1. Read the failed check (`scripts/doctor.md`).
2. Still stuck → [doctor Issue](https://github.com/Aero123421/oss-bot/issues/new?template=doctor.yml) with **exact command** + **full doctor output**.

## Runtime (API, token-gated)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/runtime` | meta + handles |
| POST | `/api/v1/runtime/start` | `{ bot_id?, mode?: "docker"\|"local", image? }` |
| GET | `/api/v1/runtime/:id/status` | refresh |
| POST | `/api/v1/runtime/:id/stop` | stop |

Default mode: **docker** when daemon reachable, else **local**.

## CredBridge

UI shows **status only** — never secrets. Host login only; RO mounts via `docker-compose.dev.yml` (see `.env.example` / `docs/if-v4-credential-bridge.md`).

| Provider | Host default | In-container |
| --- | --- | --- |
| Claude | `~/.claude` | `/host-creds/claude` |
| Codex | `~/.codex` | `/host-creds/codex` |
| OpenCode | `~/.local/share/opencode` | `/host-creds/opencode` |

## Docs

| Doc | Purpose |
| --- | --- |
| [`docs/WOW.md`](docs/WOW.md) | Release MUST / instant FAIL |
| [`web/README.md`](web/README.md) | Case B UI (AuthGate, WS, 窓口) |
| [`scripts/doctor.md`](scripts/doctor.md) | Doctor check IDs |
| [`RISKS.md`](RISKS.md) | Sock / secrets / wipe risks |

**Out of scope for MUST:** remote reachability (deferred).

## Contributing

Issue templates: `bug` / `feature` / `doctor`. PRs against `main` only.
