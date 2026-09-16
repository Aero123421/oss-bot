# oss-bot web (Case B — AI Slack)

Vite + React workspace UI. **Dispatcher only** — no provider direct calls, no mock acceptance path.

## Dev

```bash
# terminal 1 — API (AuthGate open)
cp ../.env.example ../.env   # set OSS_BOT_TOKEN (non change-me)
cd .. && npm run dev

# terminal 2 — UI
npm ci && npm run dev
```

Open http://localhost:5173/ — enter the same token (password field; not re-displayed).

## AuthGate

- Closed: dedicated empty state (not empty chat home)
- Open: sidebar rooms/DMs with ★参謀（窓口） pinned; Ready/未ログイン from CredBroker status labels only

## Build

```bash
npm ci && npm run build
```

Output: `web/dist` (optional static serve from API).
