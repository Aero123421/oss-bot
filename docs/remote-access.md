# Remote access (skeleton)

Status: placeholder until remote gateway exists.

## Intent

Use the bot on another device without weakening local-first defaults.

## Setup (TBD)

```bash
# PLACEHOLDER
oss-bot remote enable
```

## When the link drops

1. Confirm the **local** process is still up.
2. Check network / auth (token expired, firewall, DNS).
3. Re-run enable / reconnect (command TBD).
4. If intermittent, file as known issue for Release notes; see [Runbook § Remote disconnect](runbook-oncall.md#remote-disconnect).

## Safety

- Prefer reverse tunnel / explicit allowlist over open bind.
- Never paste tokens into Issues; redact doctor output if needed.
