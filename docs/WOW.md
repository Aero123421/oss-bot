# WOW / 品質ゲート（MUST）

Release requires **both** gates PASS. 「要改善で通す」は不可 — no soft pass.

## 合否判定 / Pass rule

| Gate | Result |
| --- | --- |
| 機能ゲート Feature | PASS or FAIL |
| Wowゲート Wow (blockers) | PASS or FAIL |

**Release = Feature PASS ∧ Wow PASS.**  
Either FAIL → no release. Partial credit / “ship with follow-ups” is **not** allowed for MUST items below.

---

## 機能ゲート / Feature gate

All must hold:

1. **実CLI ≥ 1** — At least one real CLI path works end-to-end (not mock-only).
2. **UI完成度** — First look matches “AI版Slack” bar (channels / threads / empty / unread / realtime affordances readable).
3. **リモート到達** — Remote reachability path works for a fresh client.

---

## Wowゲート（ブロッカー） / Wow gate (blockers)

Any miss = Wow **FAIL**:

1. **初見5分で価値** — New user sees clear value within 5 minutes.
2. **compose一発** — `docker compose up` (or documented one-shot) brings a usable stack.
3. **失敗表示明瞭** — Failures are explicit in UI/logs (no silent dead ends).
4. **再起動後履歴** — History survives process/container restart.
5. **チャンネル・スレッド・空状態・未読・リアルタイム** — If these look fake / invisible on first glance → FAIL.

---

## 即FAIL / Instant FAIL

Any one → overall **FAIL** (no release):

| ID | Condition |
| --- | --- |
| F1 | mock応答が本線 Mock responses on the primary path |
| F2 | 秘密のUI露出 Secrets visible in UI |
| F3 | RuntimeなしBot会話 Bot chat without Runtime |
| F4 | CredBridge未Ready会話 Chat while CredBridge not Ready |
| F5 | sock黙ってハング Socket hangs with no user-visible error |
| F6 | 生秘密ログ Raw secrets in logs |

---

## CredBridge ルール / CredBridge rules

- UI shows **status only** (Ready / not Ready / error) — never secret material.
- **生秘密即NG** — raw secrets in UI or logs = instant FAIL (F2 / F6).
- **未Ready会話不可** — no agent conversation until CredBridge is Ready (F4).
- **sock最小権限** — socket / bridge permissions stay least-privilege.

---

## 再現の型 / How to verify (shape)

For each MUST item, record:

1. Command or UI steps  
2. Expected pass signal  
3. Evidence (screenshot / log excerpt, secrets redacted)

Do not mark PASS without evidence. Do not override FAIL with “will fix later.”
