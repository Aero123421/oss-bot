# oss-bot

On-prem agent platform. **Node 22 + TypeScript + Hono + SQLite + Docker runtime.** No Postgres / Redis.

## S0 — localhost landing

```bash
cp .env.example .env
# set OSS_BOT_TOKEN to a long random string (required)
docker compose up --build
```

```bash
curl -s localhost:3000/healthz
curl -s -H "Authorization: Bearer $OSS_BOT_TOKEN" localhost:3000/api/v1/me
```

Stop: `docker compose down` (keep volume). Do **not** use `down -v` unless you intend to wipe SQLite.

### Dev overlay (Docker sock + CredBridge RO mounts)

```bash
export DOCKER_GID="$(getent group docker | cut -d: -f3)"   # required, not 0
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## S2 — Runtime (CP)

Token-gated:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/runtime` | meta + handles (flags only) |
| POST | `/api/v1/runtime/start` | body: `{ bot_id?, mode?: "docker"\|"local", image? }` |
| GET | `/api/v1/runtime/:id/status` | refresh status from Docker/local |
| POST | `/api/v1/runtime/:id/stop` | stop handle |

Default mode is **docker** when daemon is reachable, else **local** fallback. No Tailscale/CF in P0.

## Doctor

`npm run doctor` — host / docker / sqlite / token / CredBridge path checks.  
`npm run doctor:ci` — CI mode with `--strict`.

## Risks

See `RISKS.md`. Secrets stay on the host / `.env` only.

## CredBridge (dev)

RO bind-mounts (see `docker-compose.dev.yml` / IF v4):

| Provider | Host default | In-container |
| --- | --- | --- |
| Claude Code | `~/.claude` | `/host-creds/claude` (`CLAUDE_CONFIG_DIR`) |
| Codex | `~/.codex` | `/host-creds/codex` (`CODEX_HOME`) |
| OpenCode | `~/.local/share/opencode` | `/host-creds/opencode` (`OPENCODE_DATA_DIR`) |

Login on the host only. Never bake credentials into the image or the repo.
