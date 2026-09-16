# features/chat (P0 foundation)

Grok-class chat UI core: types, store, mock stream, `useChatStream`.

## Contract (backend)

- REST: `/bots`, `/adapters`, `/bots/:id/chats`, `/chats/:chatId/messages`
- WS: `/ws?chatId=`
- `StreamEvent`: `token` | `tool` | `status` | `error` | `done`

## Files

| Path | Role |
|---|---|
| `types.ts` | Domain + wire events |
| `store/chatStore.ts` | Bots / chats / messages / status |
| `lib/mockStream.ts` | Local WS stand-in |
| `hooks/useChatStream.ts` | send / stop / retry |

## Next (PR-F1 UI)

- `components/Sidebar` (BotList + ConversationList)
- MessageList / Bubbles / Composer / SendOrStop / StreamingStatusBar
- Swap `runMockStream` → real WebSocket inside `useChatStream`

Virtualized MessageList = P1.
