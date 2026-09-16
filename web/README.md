# web/ — Case B (AI版Slack) UI

S6: AuthGate空状態 · Dispatcher窓口DM上位固定 · Room/DM · Bot Ready/未ログイン · **実WebSocket**（mock本線なし）

## Run

```bash
cd web
npm i
npm run dev
```

Proxy: `/api` and `/ws` → `http://127.0.0.1:3000`

Token: `VITE_OSS_BOT_TOKEN` or `?token=` or localStorage after AuthGate.
Demo AuthGate: `?auth=0`

Default landing: **参謀（窓口）DM** with seed thread (not empty home).

## Contract

- POST `/api/v1/chats/:threadId/messages`
- WS `/ws?chatId=` — events `token|tool|status|error|done`
- Selection: `selectedSessionId` = `threads.id`
