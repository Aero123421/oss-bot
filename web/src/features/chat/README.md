# features/chat (案B)

Grok-class / AI-Slack chat core under `web/src/features/chat`.

## Contract

- WS: `/ws?chatId=` (VITE_API_BASE or same-origin)
- `StreamEvent`: `token` | `tool` | `status` | `error` | `done`
- `selectedSessionId` = thread; `activeBotId` = responder (switch ≠ wipe thread)
- CredBroker labels only: Ready | 未ログイン | doctor_failed …

## Main path

| Path | Role |
|---|---|
| `types.ts` | Domain + wire events |
| `store/chatStore.ts` | rooms / bots / sessions / approvals |
| `hooks/useChatStream.ts` | **real WebSocket** send / stop / retry |
| `lib/wsUrl.ts` | WS URL from env / origin |
| `lib/seed.ts` | Demo seed (参謀 DM home) |
| `lib/mockStream.ts` | **OFF MAIN PATH** (PR#7 archive) |

AuthGate: `?auth=0` forces empty state for demo.
