# IF v4 — CredentialBridge / 組織OS境界

承認前提: Runtime既定=Docker（localは開発フォールバック） / Reach=localhost → Tailscale → Cloudflare  
基準: 「えっこれGrok Botやん」＝AI版Slack（コンピュータ付きAI同僚の組織OS）  
mock止まり・表層だけのVM・UIへの鍵貼り本線は不合格。

## Slack写像（固定）

| Slack | oss-bot |
| --- | --- |
| Member | Bot |
| Channel | Group |
| DM入口（窓口） | 参謀窓口 + Dispatcher |
| 振り分け | Dispatcher |

- 各 Member の裏に Runtime（コンピュータ）が必須
- ホームは窓口 DM、Channel は組織会議
- User Window は常に一つの窓。原則は窓口と話し、Dispatcher が振り分ける

## レイヤ

```
User Window → Dispatcher(窓口) → Control Plane
  → Runtime Adapter / Provider Adapter / Reach Adapter
  → CapabilityHost（FS / Shell / Browser / CredBroker）
  → AgentBus
```

- UI は Control Plane の HTTP + WS のみ
- コアはアダプタ実装を知らない。追加はアダプタ増設のみ（コアへのプロバイダ分岐 `if` 禁止）

## 第一級エンティティ

Dispatcher / Bot / Group / Membership / Session(Thread) / RuntimeHandle /  
CapabilityGrant / ReachEndpoint / Routine / Skill / BusMessage / AuthGate /  
**CredBroker / CredGrant / ProviderCredAdapter**

## Control Plane API（抜粋）

- **Dispatcher**: ユーザー発話の受付・振り分け・エスカレーション
- **Bot**: CRUD、role、改名、group 配属
- **Group**: 会議（複数 Bot 参加）、議事は Bus 経由
- **Session**: WS ストリーム必須。履歴・スレッドは CP が保持
- **Runtime**: start / stop / status（UI 表示と一致）
- **Capability**: `FS.list/read/write`、`Shell.exec`、`Browser.*` を Runtime 上に公開（stdio 止め禁止）
- **AgentBus**: Bot↔Bot / Bot↔Dispatcher の非同期メッセージ（priority 可）
- **Routine / Skill**: 放置しても進む。cron/event 発火、再利用手順
- **Reach**: `localhost` | `tailscale` | `cloudflare`
- **AuthGate**: 共有トークン。未設定は拒否。アプリ設定シークレットは `.env` のみ

## CredentialBridge（必須・調査ベース）

原則:

1. ログインは **ホストのみ**
2. UI への鍵貼り付けは **非本線**（補助なら警告つき）
3. **散在コピー禁止**

流れ:

```
CredBroker → ProviderCredAdapter → Runtime へ供給
```

### 許可する供給方法

1. **RO bind-mount（推奨）**
   - Claude Code: host `~/.claude`（+ config）。`CLAUDE_CONFIG_DIR` 可。OAuth は `.credentials.json` 等
   - Codex: host `CODEX_HOME` / `auth.json`（**file store 前提**）。OS keyring のみの場合は file へ寄せるか、アダプタで非対応を明示
   - OpenCode: host `~/.local/share/opencode/`（`auth.json` / db）
   - 他（agy / opencode / pi / Kimi 等）: Adapter が host path / env を宣言
2. **env 注入**: CLI が公式支援するトークン変数のみ（例: `CLAUDE_CODE_OAUTH_TOKEN`）。使い捨て exec 用キーは永続化しない

### 禁止

- コンテナイメージ層へ焼く
- リポジトリ・UI 状態へ保存
- 複数 Bot へ秘密を複製コピー
- CP ログに秘密の中身を出す
- Capability API のレスポンスに秘密を載せる

### Ready 判定

```
host auth status / doctor → CredGrant → runtime 内で再 status
```

未 Ready は会話開始不可。状態例: 未インストール / 未ログイン / doctor失敗 / Ready / 実行中。

## BYO CLI

Provider Adapter はマルチ前提（Codex / Claude Code / agy / opencode / pi / Kimi …）。  
1 社固定 UI・コア分岐は不合格。Bot 作成時にプロバイダ必須選択。

## アダプタ境界

Runtime / Provider / Reach / CapabilityHost / ProviderCredAdapter — いずれも同一 IF で差し替え。  
契約は semver。破壊的変更はメジャー。拡張は IF 追加で吸収。

## 禁止まとめ

- UI → Runtime / Provider 直叩き
- 窓口なしをデフォルトにする
- Capability なし Bot を本番扱い
- mock のみ受け入れ
- Bus なしの同期呼び合い前提
- Provider が Reach を知る / Runtime が Provider 固有を知る

## P0（設計側・凍結解除に必要）

Dispatcher 窓 + Member/Channel + Runtime 実体 + Capability 1つ以上可視 + CLI 実接続 ≥1 + CredBridge + AgentBus 振り分け 1 経路 + localhost + README

Reach（Tailscale / CF）と Routine 実行は IF に残し、動線完成は P1 可（IF から消さない）。
