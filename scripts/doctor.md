# doctor（SQLite + Docker bot runtime）

Exit 0/1/2. No Postgres/Redis checks (stack excludes them).

| ID | Area | Notes |
|----|------|-------|
| H1–H2 | Host Node/npm | Node >= 22 |
| D1–D5 | Docker/Compose | D5 fails if compose still has postgres/redis images |
| Q1–Q3 | SQLite file path | volume/dir writable |
| T1–T4 | Token gate | OSS_BOT_TOKEN; .env not tracked |
| B1–B5 | Bot runtime | BOT_RUNTIME=docker; prod+sock=FAIL; DOCKER_GID required for overlay |
| P2–P4 | HTTP (`--require-running`) | healthz; 401 without token; 2xx with token |
| P2 | HTTP | optional `--require-running` |
| CI2–CI5 | CI | .env.example keys; non-empty apps/api |

| B4 | prod + sock overlay | FAIL |
| B5 | DOCKER_GID for overlay | FAIL if missing/0 |
| P3–P4 | token gate live | with `--require-running` |
| CB1–CB4 | CredBridge host paths | existence only; no secret contents |

## Providers (install vs auth)

Mandatory provider_id set (IF v4.1): `claude-code` | `codex` | `opencode` | `agy` | `pi` | `kimi` | `grok`

| Check | Meaning |
| --- | --- |
| `P-*-INSTALL` | CLI binary on PATH |
| `P-*-AUTH` | CredBridge host dir + auth marker exists (contents never read) |
| `CB-READY` | ≥1 provider has install+auth |
| `CB-ENV` | `.env.example` lists all `*_HOST` keys |
| `CB-MOUNT` | dev overlay RO mounts expected |

Host path env keys (must match compose): `CLAUDE_CONFIG_HOST` `CODEX_HOME_HOST` `OPENCODE_DATA_HOST` `AGY_CONFIG_HOST` `PI_CONFIG_HOST` `KIMI_CONFIG_HOST` `GROK_CONFIG_HOST` (grok also accepts `XAI_API_KEY` presence / `grok login`)

