# IF v4.1.1 — CredentialBridge / 組織OS境界

承認前提: Runtime既定=Docker（localは開発フォールバック） / Reach=localhost → Tailscale → Cloudflare  
基準: 「えっこれGrok Botやん」＝AI版Slack（コンピュータ付きAI同僚の組織OS）  
mock止まり・表層だけのVM・UIへの鍵貼り本線は不合格。

**v4.1 変更:** P0 の「Claude Code 1本だけ本線」を廃止。BYO は全プロバイダ本線。`ProviderCredAdapter` は全 Provider ID 分必須。
**v4.1.1:** Provider ID に `grok` を追加（ユーザー必須）。

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
- **Bot**: CRUD、role、改名、group 配属。作成時 **provider_id 必須**
- **Group**: 会議（複数 Bot 参加）、議事は Bus 経由
- **Session**: WS ストリーム必須。履歴・スレッドは CP が保持
- **Runtime**: start / stop / status（UI 表示と一致）。`sleep infinity` のみは不合格。Capability 1 発以上必須
- **Capability**: `FS.list/read/write`、`Shell.exec`、`Browser.*` を Runtime 上に公開
- **AgentBus**: Bot↔Bot / Bot↔Dispatcher の非同期メッセージ（priority 可）
- **Routine / Skill**: 放置しても進む。cron/event 発火、再利用手順
- **Reach**: `localhost` | `tailscale` | `cloudflare`
- **AuthGate**: 共有トークン。未設定は拒否。アプリ設定シークレットは `.env` のみ

## Provider ID（本線・固定セット）

次を **すべて** 第一級とする（1 社固定 UI・「枠だけ」扱いは不合格）:

| provider_id | CLI 想定 | CredAdapter 必須 |
| --- | --- | --- |
| `claude-code` | Claude Code | Yes |
| `codex` | OpenAI Codex CLI | Yes |
| `opencode` | OpenCode | Yes |
| `agy` | agy | Yes |
| `pi` | pi | Yes |
| `kimi` | Kimi CLI | Yes |
| `grok` | Grok CLI | Yes |

- レジストリに無い ID で Bot 作成不可
- 新規プロバイダ追加 = **Adapter 追加のみ**（コア改修禁止）
- ホストに未インストールのプロバイダは状態 `未インストール`（UI から消さない）

## CredentialBridge（必須・全 Adapter）

原則:

1. ログインは **ホストのみ**
2. UI への鍵貼り付けは **非本線**（補助なら警告つき）
3. **散在コピー禁止**

流れ:

```
CredBroker → ProviderCredAdapter[provider_id] → Runtime へ供給
```

### ProviderCredAdapter 必須 IF（全 ID 同一）

各 Adapter が実装すること:

- `detect()` — ホストに CLI があるか
- `doctor()` / `authStatus()` — ログイン・健全性
- `credSpec()` — bridge に使う host paths / env 名を宣言
- `bridge(grant) → runtime mounts|env` — 供給マニフェスト
- `ready()` — host status → grant → runtime 再 status

未実装 Adapter = ビルド失敗扱い（スタブで `unsupported` を返すのも、登録だけして中身空は不可。最低限 detect/doctor/credSpec を実パスで埋める）。

### 許可する供給方法

1. **RO bind-mount（推奨）**
   - `claude-code`: host `~/.claude`（+ config）。`CLAUDE_CONFIG_DIR` 可
   - `codex`: host `CODEX_HOME` / `auth.json`（**file store 前提**）。keyring のみなら file へ寄せか非対応を `doctor` で明示
   - `opencode`: host `~/.local/share/opencode/`（`auth.json` / db）
   - `agy` / `pi` / `kimi`: 各 Adapter の `credSpec()` が host path/env を宣言（調査して埋める。不明のままコアに分岐を書かない）
2. **env 注入**: CLI 公式のトークン変数のみ。使い捨てキーは永続化しない

### 禁止

- コンテナイメージ層へ焼く
- リポジトリ・UI 状態へ保存
- 複数 Bot へ秘密を複製コピー
- CP ログ / Capability レスポンスに秘密の中身

### Ready 判定

```
host detect → auth status / doctor → CredGrant → runtime 内再 status
```

未 Ready は会話開始不可。状態: 未インストール / 未ログイン / doctor失敗 / Ready / 実行中。  
**プロバイダ A が未ログインでも、Ready なプロバイダ B の Bot は動く。**

## BYO CLI

- UI は全 `provider_id` を選択可能
- 「今夜は Claude だけ本線、他は枠」は **廃止**
- 合格条件: 登録全 Adapter が存在し、ホストで Ready なプロバイダは実接続できること（最低 1 本 Ready で会話デモ可、ただし他 ID の Adapter 欠落は不合格）

## アダプタ境界

Runtime / Provider / Reach / CapabilityHost / ProviderCredAdapter — 同一 IF で差し替え。semver。

## 禁止まとめ

- UI → Runtime / Provider 直叩き
- 窓口なしをデフォルトにする
- Capability なし / `sleep infinity` のみ Runtime
- mock のみ受け入れ
- 単一プロバイダ前提のコア論理
- Provider が Reach を知る / Runtime が Provider 固有を知る

## P0（設計側）

Dispatcher 窓 + Member/Channel + Runtime 実体 + Capability(FS|Shell) + **全 ProviderCredAdapter** + Ready な CLI 実接続 + CredBridge + AgentBus 振り分け 1 経路 + localhost + README

Reach（Tailscale / CF）と Routine 実行の動線完成は P1 可（IF から消さない）。
