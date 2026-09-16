# WOW / 合格ゲート（MUST）

正本は **戦略合格6点**（⑤はユーザー絶対により **BYO全プロバイダ本線** に更新）。

**合否:** 6点すべて PASS かつ 即FAILなし かつ 品質付帯を満たす。「要改善で通す」は不可。

**後回しは対象外:** リモート到達（Tailscale/CF実機）。

---

## 合格6点 / MUST

| # | 項目 | Pass signal |
| --- | --- | --- |
| 1 | README → localhost → 窓口会話 | Follow README; open localhost; one conversation via the entry/dispatcher window |
| 2 | 役割Bot ≥ 2・切替 | At least two role bots; switch between them |
| 3 | グループ＋振り分け一発 | Group + one routing/dispatch in a single flow |
| 4 | Runtime＋FS か Shell 1発 | Real Runtime; prove with one FS **or** one Shell action |
| 5 | **BYO全プロバイダ本線** | 下記マトリクスの **すべて** が ProviderCredAdapter + Provider Adapter 本線実装。Bot作成時に選択可。doctor が検出。UI に Ready/未インストール/未ログイン。ホストに入っているプロバイダは実RTT、未導入は明確に未Ready（偽Ready禁止）。**『1本だけ実接続・他は枠/stub』は不合格** |
| 6 | CredBridge | 全プロバイダの資格情報は CredBridge のみ。散在コピー禁止。UIは状態のみ |

### ⑤ 必須プロバイダ・マトリクス

| id | CLI | ホスト認証の典型 | CredBridge |
| --- | --- | --- | --- |
| `claude` | Claude Code | `~/.claude` / `CLAUDE_CODE_OAUTH_TOKEN` | RO mount or 公式env |
| `codex` | Codex | `~/.codex` / `CODEX_HOME` / API key login | RO mount（file store） |
| `opencode` | OpenCode | `~/.local/share/opencode/` | RO mount |
| `agy` | OpenCode + agy auth | OpenCode accounts / plugin | Adapter宣言パス |
| `pi` | pi CLI | Adapterが host path/env を宣言 | 同上 |
| `kimi` | Kimi / Moonshot | `~/.kimi/credentials/` + `kimi login` | RO mount |
| `grok` | Grok CLI | `~/.grok/auth.json` / `XAI_API_KEY` / `grok login` | RO mount or 公式env |

追加プロバイダは **アダプタ増設のみ**（コアに `if provider` 禁止）。

### 再現の型

For each row: steps → expected signal → evidence (screenshot/log, secrets redacted). No PASS without evidence.

---

## 即FAIL / Instant FAIL

| | Condition |
| --- | --- |
| F1 | mock応答が本線 |
| F2 | 秘密露出（UI/ログ） |
| F3 | RuntimeなしBot会話 |
| F4 | 必須プロバイダが枠/stubのまま「選べる」見せ金 |
| F5 | CredBridge外への秘密複製 |

---

## 品質付帯

| | Rule |
| --- | --- |
| A1 | AuthGate空は拒否 |
| A2 | Ready必須（未Readyは会話開始不可） |
| A3 | UIは状態のみ・秘密非表示 |
| A4 | 散在コピー禁止 |
| A5 | doctor が全必須プロバイダを列挙し、install/auth を区別 |

---

## 対象外

リモート到達実機。上記以外の機能追加で MUST を膨らませない。
