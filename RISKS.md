# リスクとロールバック

## 適用対象
Docker / Compose / env / doctor（P0）。Postgres・Redis は使わない。

## リスク
1. **OSS_BOT_TOKEN 漏洩** — `.env` をコミットしない（gitignore + doctor T4）
2. **デフォルトトークン** — production 起動を拒否。compose 前に `.env` 必須
3. **SQLite ボリューム削除** — `docker compose down -v` でデータ消失。運用では禁止
4. **単一ファイル DB** — 複数レプリカ不可。スケールアウトは別設計

## ロールバック
- 設定: 前の `docker-compose.yml` / `Dockerfile` に戻して `up -d --build`
- データ: `ossbot-data` ボリュームのバックアップから復元（手順は別途）
- トークンローテ: `.env` 更新 → `compose up -d`（ダウンタイム短）
