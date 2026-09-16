# WOW Gate (MUST)

リリース条件: **機能ゲート** と **Wowゲート** の **両方 PASS**。  
「要改善で通す」「Ship with follow-ups」は **不可**。

Release requires BOTH Functional gate AND Wow gate to **PASS**. Shipping with known gaps is **not allowed**.

---

## Functional MUST（ブロッカー）

1. **実CLI ≥1** — docsどおり成功。失敗メッセージに次アクションがある。`doctor` 失敗時は `serve` を遮断する。
2. **UI完成度（AI版Slack初見）** — 主要導線が途切れない。空状態・エラー・ストリーム中が仮UIに見えない。チャンネル／スレッド／未読／リアルタイムの導線がある。
3. **リモート到達** — 実接続で1往復以上。不通・部分失敗を成功に見せない。

---

## Wow MUST（ブロッカー）

1. **初見5分** — AI版Slackのワークスペース感で「使える」と言える。
2. **compose一発** — 入力→送信が一操作で完結。二重送信・フォーカス喪失なし。
3. **失敗表示** — エラーが伝わる。黙ってハングしない。生スタック／秘密を晒さない。
4. **再起動後履歴** — 仕様どおり残る／消える。
5. **導線の完成度** — チャンネル／スレッド／空状態／未読／リアルタイムが仮に見えない。

---

## Instant FAIL（即不合格）

- **mock応答が本線**（受け入れ・デモ本線が mock）
- **秘密のUI露出**（鍵貼り付け本線、状態以外に生秘密）
- **Runtime なし Bot との会話**
- **CredBridge 未 Ready での会話**
- **sock／Ready 待ちの黙ってハング**
- **ログ／レスポンス／エラー／URL への生秘密**

---

## CredBridge MUST

- UI は **状態のみ**（Ready／未Ready／失敗理由）。生秘密は即 FAIL。
- **未 Ready Bot は会話不可**。
- sock は **最小権限**（GID 明示・必要キーのみ）。
- Ready／失敗は即状態表示。黙って待たない。

---

## 判定

| 結果 | 意味 |
| --- | --- |
| PASS | 上記 MUST すべて緑 |
| FAIL | いずれか欠落。リリース不可 |

合否はこのファイルの MUST のみを正とする。
