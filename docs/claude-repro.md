# Claude 実接続 再現（合格⑤）

前提: AuthGate は **`OSS_BOT_TOKEN`（env）**。P0 では DB `auth_gates` 未使用（予約）。HTTP に出すのは `CredBroker.status` のみ。`issue()` の env はレスポンス禁止。

## Host 準備

1. Claude Code をホストにインストールし、ホストでログイン（`~/.claude`）
2. または公式 `CLAUDE_CODE_OAUTH_TOKEN` のみ（UI貼り付け非本線）
3. `npm run doctor` / Cred status が Ready

## 起動

```bash
cp .env.example .env   # OSS_BOT_TOKEN を設定
# compose なら infra 手順。ローカル:
OSS_BOT_TOKEN=... npx tsx src/index.ts
```

## 証拠コマンド（④ Capability）

```bash
TOKEN=your-token
# start
curl -sS -X POST localhost:3000/api/v1/runtime/start \
  -H "x-oss-bot-token: $TOKEN" -H 'content-type: application/json' \
  -d '{"mode":"local"}'
# → handle.id を RID に
curl -sS localhost:3000/api/v1/runtimes/$RID/capabilities -H "x-oss-bot-token: $TOKEN"
curl -sS -X POST localhost:3000/api/v1/runtimes/$RID/capabilities/exec \
  -H "x-oss-bot-token: $TOKEN" -H 'content-type: application/json' \
  -d '{"kind":"shell.exec","command":"echo oss-bot-capability-ok"}'
```

期待: `stdout` に `oss-bot-capability-ok`。`cred/status` に env 値は出ない。

## ⑤ Claude 実応答

```bash
# Ready 確認（秘密なし）
curl -sS 'localhost:3000/api/v1/cred/status?purpose=provider:claude' \
  -H "x-oss-bot-token: $TOKEN"
# Dispatcher（窓口のみ）
curl -sS -X POST localhost:3000/api/v1/dispatcher/messages \
  -H "x-oss-bot-token: $TOKEN" -H 'content-type: application/json' \
  -d '{"content":"Say hi in one sentence"}'
# SSE
curl -sSN "localhost:3000/api/v1/threads/$THREAD_ID/events" \
  -H "x-oss-bot-token: $TOKEN"
```

未 Ready なら 503 `not_ready`。CLI 未インストールなら assistant メッセージに `claude_cli_not_found`（秘密なし）。
