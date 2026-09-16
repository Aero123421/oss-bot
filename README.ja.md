# oss-bot

オンプレのエージェントチャット（AI版Slack）。**Node 22 + TypeScript + Hono + SQLite + Docker runtime。** Postgres / Redis なし。

受け入れ: [`docs/WOW.md`](docs/WOW.md)。English: [`README.md`](README.md)。

## クイックスタート（README → localhost → 窓口）

```bash
cp .env.example .env
# OSS_BOT_TOKEN に十分長いランダム文字列を入れる（必須）
docker compose up --build
```

```bash
curl -s localhost:3000/healthz
curl -s -H "Authorization: Bearer $OSS_BOT_TOKEN" localhost:3000/api/v1/me
```

**Chat UI:** **http://localhost:8080** を開く — nginx が `web/` を配信し、`/api` と `/ws` を API にプロキシ（同一オリジン）。

- AuthGate でトークン入力（再表示しない）
- 初期画面: **参謀（窓口）DM** — ここで1通送る（WOW #1）
- AuthGate 空のデモ: `?auth=0`（空は拒否 — WOW 付帯 A1）

停止: `docker compose down`（SQLite ボリュームは残る）。消すつもりがなければ `down -v` は使わない。

### UI だけ開発（任意）

```bash
cd web && npm i && npm run dev
```

Vite は http://localhost:5173。手順の本線は compose の **:8080**。

### Dev オーバーレイ（Docker sock + CredBridge RO）

```bash
export DOCKER_GID="$(getent group docker | cut -d: -f3)"   # 必須、0 不可
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Doctor（失敗したら）

```bash
npm run doctor
npm run doctor:ci
```

1. 落ちたチェックを確認（`scripts/doctor.md`）。
2. 直らなければ [doctor Issue](https://github.com/Aero123421/oss-bot/issues/new?template=doctor.yml) に **コマンド** と **doctor 全出力**。

## Runtime / CredBridge / Docs

API 表・CredBridge・ドキュメント一覧は [README.md](README.md) と同じ。MUST 対象外: リモート到達（後回し）。

## コントリビュート

Issue テンプレ: `bug` / `feature` / `doctor`。PR は `main` 向けのみ。
