# WOW / 合格ゲート（MUST）

正本は **戦略合格6点** のみ。

**合否:** 6点すべて PASS かつ 即FAILなし かつ 品質付帯を満たす。「要改善で通す」は不可。

**後回しは対象外**（MUSTに入れない / CUTで落とさない）。例: **リモート到達**。

---

## 合格6点 / MUST

| # | 項目 | Pass signal |
| --- | --- | --- |
| 1 | README → localhost → 窓口会話 | Follow README; open localhost; one conversation via the entry/dispatcher window |
| 2 | 役割Bot ≥ 2・切替 | At least two role bots; switch between them |
| 3 | グループ＋振り分け一発 | Group + one routing/dispatch in a single flow |
| 4 | Runtime＋FS か Shell 1発 | Real Runtime; prove with one FS **or** one Shell action |
| 5 | Claude実接続1本・他は枠 | One live Claude connection; other providers may be stubs/slots |
| 6 | CredBridge | Credentials only via CredBridge |

### 再現の型

Steps → expected signal → evidence (screenshot/log, secrets redacted). No PASS without evidence.

---

## 即FAIL / Instant FAIL

Any one → overall **FAIL**:

| | Condition |
| --- | --- |
| F1 | mock応答が本線 Mock on the primary path |
| F2 | 秘密露出 Secrets exposed in UI or logs |
| F3 | RuntimeなしBot会話 Bot chat without Runtime |

---

## 品質付帯 / Quality accompanying

| | Rule |
| --- | --- |
| A1 | **AuthGate空は拒否** — empty AuthGate must reject |
| A2 | **Ready** — Ready required before protected flows |
| A3 | **秘密非表示** — UI shows status only; never secret material |
| A4 | **散在コピー禁止** — no scattered credential copies outside CredBridge |

---

## 対象外 / Out of scope

Deferred work (e.g. リモート到達) and anything outside the 6 points + 付帯 above is **not** a release checklist item here.
