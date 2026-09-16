# `oss-bot doctor` 検査項目（確定スタック版）

CLI: `npm run doctor` / `node dist/scripts/doctor.js`
Exit: 0=OK / 1=WARN（`--strict` で非0） / 2=FAIL

前提: Node+TS+Hono+SQLite+Compose / トークンゲート / No Postgres・No Redis

## ホスト
| ID | 項目 | 判定 |
|----|------|------|
| H1 | Node.js >= 22 | FAIL |
| H2 | `npm` + package.json | FAIL |
| H2b | `package-lock.json` 必須 | FAIL |
| H3 | 空きディスク >= 1GB（SQLite+ログ） | WARN <2GB / FAIL <500MB |
| H4 | `git`, `curl` | FAIL / WARN |

## Docker / Compose
| ID | 項目 | 判定 |
|----|------|------|
| D1 | `docker info` | WARN（ローカル npm 開発のみなら）/ FAIL（compose 必須時 `--require-docker`） |
| D2 | `docker compose version` | 同上 |
| D3 | `Dockerfile` と `docker-compose.yml` 存在 | FAIL |
| D4 | compose config が parse できる | FAIL |

## SQLite
| ID | 項目 | 判定 |
|----|------|------|
| Q1 | `DATABASE_PATH` 設定あり | FAIL |
| Q2 | 親ディレクトリが書込可（なければ作成提案） | FAIL |
| Q3 | DB ファイル open + `SELECT 1`（ファイル無ければ WARN＝初回起動で作成） | WARN/FAIL |
| Q4 | schema version / migrations 適用済み（テーブル存在） | FAIL after first boot |

## トークンゲート
| ID | 項目 | 判定 |
|----|------|------|
| T1 | `OSS_BOT_TOKEN` が非空 | FAIL |
| T2 | デフォルト値 `change-me*` を production で使っていない | FAIL if NODE_ENV=production |
| T3 | トークン長 >= 16 | WARN |
| T4 | `.env` が git 追跡されていない | FAIL |

## プロセス / HTTP
| ID | 項目 | 判定 |
|----|------|------|
| P1 | `PORT` 空き（または自プロセスが listen） | WARN |
| P2 | `GET /healthz` → 200（起動中のみ） | FAIL if `--require-running` |
| P3 | 無トークンで保護ルートが 401 | FAIL if running |
| P4 | 正トークンで保護ルートが 2xx | FAIL if running |

## CI（`--ci`）
| ID | 項目 | 判定 |
|----|------|------|
| CI1 | `.env` がコミットされていない | FAIL |
| CI2 | `.env.example` に必須キーが揃っている | FAIL |
| CI3 | Dockerfile が non-root USER | WARN |
| CI4 | HEALTHCHECK 定義あり | WARN |

実装は読み取り優先。修復はヒント1行。`--json` 対応。
