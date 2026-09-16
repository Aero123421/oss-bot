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
