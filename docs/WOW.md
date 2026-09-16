# WOW / 合格ゲート（MUST）

正本は **戦略合格6点** のみ。後回し項目はチェック対象外。余計な項目で実装を広げない。

**合否:** 6点すべて PASS。CredBridge 付帯を満たすこと。「要改善で通す」は不可。

---

## 合格6点 / MUST

| # | 項目 | Pass signal |
| --- | --- | --- |
| 1 | README → localhost → 窓口会話 | Follow README; open localhost; complete one conversation via the dispatcher/entry window |
| 2 | 役割Bot ≥ 2・サイドバー切替 | At least two role bots; switch them from the sidebar |
| 3 | グループ＋振り分け一発 | Create/use a group and run one routing/dispatch in a single flow |
| 4 | Runtime実体＋FS か Shell 1発 | Real Runtime present; prove with one FS **or** one Shell action |
| 5 | Claude実接続1本・他は枠 | One live Claude connection; other providers may be stubs/slots only |
| 6 | CredBridge（散在コピー禁止） | Credentials only via CredBridge; no scattered copies of secrets |

### 再現の型

For each row: steps → expected signal → evidence (screenshot/log, secrets redacted). No PASS without evidence.

---

## 付帯（CredBridge） / Accompanying

Only these CredBridge constraints — not extra product scope:

1. **UIは状態のみ** — show Ready / not Ready / error; never secret material.
2. **散在コピー禁止** — no duplicated credential files/env sprawl outside CredBridge.
3. **後回しは対象外** — deferred work is explicitly **out of checklist scope** (do not block or expand MUST for it).

---

## 対象外 / Out of scope

Anything not in the 6 points above (and not the CredBridge 付帯) is **not** a release checklist item for this doc.
