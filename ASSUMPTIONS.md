# 確定スタック（参謀 2026-09-16）

- リポ: https://github.com/Aero123421/oss-bot
- P0: Node + TypeScript + Hono + SQLite + Docker Compose
- 認証: フル認証なし。共有トークンゲート（`OSS_BOT_TOKEN`）
- やらない: Postgres / Redis
- 担当（インフラ）: compose / Dockerfile / .env.example / .gitignore / doctor
