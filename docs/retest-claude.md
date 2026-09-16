# Claude 用意後の再計測手順（1枚）

現状合否: **FAIL（環境欠落）** — ホストに Claude Code / `~/.claude` / `CLAUDE_CODE_OAUTH_TOKEN` なし。
再計測対象は **⑤ Claude 実RTT** と **⑥ CredBridge Ready** のみ（①〜④はコード本線済み前提）。

正本: [`docs/WOW.md`](./WOW.md) / 詳細再現: [`docs/claude-repro.md`](./claude-repro.md)

---

## 0. ホスト準備（どちらか）

1. Claude Code をインストールし、ホストで `claude auth login`（成果物は `~/.claude`）
2. または `.env` のみに `CLAUDE_CODE_OAUTH_TOKEN=...`（**UIに貼らない**）

```bash
cp .env.example .env   # OSS_BOT_TOKEN も必須
docker compose up --build
# UI: http://localhost:8080
```

---

## 1. Cred Ready（合格⑥）

```bash
TOKEN=$OSS_BOT_TOKEN
curl -sS "localhost:3000/api/v1/cred/status?purpose=provider:claude" \
  -H "Authorization: Bearer $TOKEN"
```

**PASS:** `status_code` が `ready`。レスポンスに秘密・トークン生値なし。
**FAIL:** `missing` / mounts・env とも false。

---

## 2. Capability 健全性（回帰・④）

```bash
RID=$(curl -sS -X POST localhost:3000/api/v1/runtime/start \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"mode":"local"}' | jq -r '.handle.id')
curl -sS -X POST "localhost:3000/api/v1/runtimes/$RID/capabilities/exec" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"kind":"shell.exec","command":"echo oss-bot-capability-ok"}'
```

**PASS:** `stdout` に `oss-bot-capability-ok`。

---

## 3. Claude 実RTT（合格⑤）

1. ブラウザで `http://localhost:8080` → AuthGate → **参謀（窓口）DM**
2. 「Say hi in one sentence」を送る
3. SSE（`GET /api/v1/threads/:id/events`）経由で assistant 応答が返る

または CLI:

```bash
curl -sS -X POST localhost:3000/api/v1/dispatcher/messages \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"content":"Say hi in one sentence","run":true}'
```

**PASS:** 意味のある Claude 応答（`claude_cli_not_found` / `not_ready` ではない）。
**即FAIL:** mock 応答、秘密のUI露出、Runtimeなし会話。

---

## 4. 報告フォーマット（参謀／プロダクトへ）

```
再計測合否: PASS | FAIL
⑥ Cred Ready: PASS/FAIL + status_code
⑤ Claude RTT: PASS/FAIL + 証拠（スクショ or ログ要約・秘密なし）
④回帰: PASS/FAIL
```
