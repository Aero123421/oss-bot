# BYO 全プロバイダ再計測（1枚）

正本: [`docs/WOW.md`](./WOW.md) ⑤⑥。詳細（Claude）: [`docs/claude-repro.md`](./claude-repro.md)。

**目的:** 必須プロバイダごとに **Cred Ready** と **実RTT**（または明確な未Ready）を1周する。  
**偽Ready禁止。** 未導入は `missing` / 未インストール明示。stub のまま「選べる」は即FAIL（WOW F4）。

再計測対象は主に **⑤ BYO全本線** と **⑥ CredBridge**（①〜④はコード本線済み前提）。

---

## 0. 共通準備

```bash
cp .env.example .env   # OSS_BOT_TOKEN 必須
docker compose up --build
# UI: http://localhost:8080
export TOKEN=$OSS_BOT_TOKEN
```

ログインは **ホストのみ**。秘密を UI / Issue / ログに出さない。

```bash
npm run doctor   # 全必須プロバイダを列挙し install/auth を区別（WOW A5）
```

---

## 必須マトリクス（WOW ⑤）

| id | ホスト準備（典型） | Cred purpose |
| --- | --- | --- |
| `claude` | Claude Code + `claude auth login`（`~/.claude`）または `CLAUDE_CODE_OAUTH_TOKEN`（envのみ） | `provider:claude` |
| `codex` | Codex CLI + login（`~/.codex` / `CODEX_HOME`） | `provider:codex` |
| `opencode` | OpenCode + auth（`~/.local/share/opencode/`） | `provider:opencode` |
| `agy` | OpenCode + agy auth（Adapter宣言パス） | `provider:agy` |
| `pi` | pi CLI + Adapter宣言の path/env | `provider:pi` |
| `kimi` | Kimi CLI + `kimi login`（`~/.kimi/credentials/`） | `provider:kimi` |
| `grok` | Grok CLI + `grok login` / `XAI_API_KEY`（`~/.grok/auth.json`） | `provider:grok` |

RO mount は `docker-compose.dev.yml` / `.env.example`（Claude・Codex・OpenCode）。他 id は Adapter 宣言に従う。

---

## 1. Cred Ready（合格⑥）— 各 id

```bash
PID=claude   # codex | opencode | agy | pi | kimi | grok
curl -sS "localhost:3000/api/v1/cred/status?purpose=provider:${PID}" \
  -H "Authorization: Bearer $TOKEN"
```

| 結果 | 判定 |
| --- | --- |
| `status_code=ready`・秘密なし | **PASS**（その id） |
| `missing` / 未インストール / 未ログイン | **未Ready OK**（偽Readyでなければ⑤の「未導入は明確に未Ready」を満たす） |
| ready なのに秘密がレスポンスに出る | **即FAIL**（F2） |
| Adapter欠落なのに UI で本線選択可 | **即FAIL**（F4） |

全 id を表に記録する（下の報告フォーマット）。

---

## 2. Capability 回帰（④・任意だが推奨）

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

## 3. 実RTT（合格⑤）— Ready な id ごと

ホストで Ready のプロバイダは **必ず** 実RTT。未Ready id は会話開始不可（A2）を確認すれば足りる。

### UI

1. `http://localhost:8080` → AuthGate  
2. その `provider_id` の Bot を選ぶ（なければ作成時に選択）  
3. 「Say hi in one sentence」を送る  
4. ストリームで assistant 応答

### CLI（窓口 / dispatcher）

```bash
curl -sS -X POST localhost:3000/api/v1/dispatcher/messages \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"content":"Say hi in one sentence","run":true}'
# Bot 指定 API がある場合は provider_id / bot_id を付与（実装のパラメータに合わせる）
```

| 結果 | 判定 |
| --- | --- |
| 意味のあるモデル応答 | **PASS**（その id の実RTT） |
| `not_ready` / `*_cli_not_found`（秘密なし） | 未導入なら **OK**；Ready 表示なのにこれ → **FAIL** |
| mock 本線 | **即FAIL**（F1） |
| Runtime なしで会話 | **即FAIL**（F3） |

---

## 4. ⑤⑥ 合否ルール（短い）

- **⑥ PASS:** 全必須 id が CredBridge 経由で status 取得でき、UIは状態のみ、散在コピーなし  
- **⑤ PASS:** 全必須 id に ProviderCredAdapter + Provider Adapter 本線あり；Ready id は実RTT；未導入は未Ready明示；**1本だけ実接続・他stubは不合格**

---

## 5. 報告フォーマット

```
再計測合否: PASS | FAIL
⑥ CredBridge: PASS/FAIL
⑤ BYO matrix:
  claude  Ready=Y/N  RTT=PASS|FAIL|N/A(未Ready)  証拠=
  codex   Ready=Y/N  RTT=PASS|FAIL|N/A(未Ready)  証拠=
  opencode Ready=Y/N RTT=PASS|FAIL|N/A(未Ready)  証拠=
  agy     Ready=Y/N  RTT=PASS|FAIL|N/A(未Ready)  証拠=
  pi      Ready=Y/N  RTT=PASS|FAIL|N/A(未Ready)  証拠=
  kimi    Ready=Y/N  RTT=PASS|FAIL|N/A(未Ready)  証拠=
  grok    Ready=Y/N  RTT=PASS|FAIL|N/A(未Ready)  証拠=
④回帰: PASS/FAIL
即FAIL: なし | F1/F2/F3/F4/F5
```

証拠はスクショ or ログ要約。**秘密・トークン生値は載せない。**
