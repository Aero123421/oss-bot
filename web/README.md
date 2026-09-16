# oss-bot web (案B UI)

Vite + React + TypeScript SPA. AI-Slack 感触のチャット UI。

## Run

```bash
cd web && npm i && npm run dev
```

- Default: lands on **参謀（窓口）** DM with seed conversation + approval card.
- AuthGate demo: open `/?auth=0`
- WS: `/ws?chatId=` via `VITE_API_BASE` or same-origin (Vite proxies to `:3000`)

## Notes

- `useChatStream` uses **real WebSocket** — mockStream is off the main path.
- Cred labels only: Ready / 未ログイン / doctor_failed (no secrets in UI).
