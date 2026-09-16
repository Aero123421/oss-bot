# oss-bot

Self-hosted AI agent chat. On-prem first.

## Quick start

```bash
# PLACEHOLDER — replace when install entrypoint is fixed
curl -fsSL https://raw.githubusercontent.com/Aero123421/oss-bot/main/install.sh | bash
```

Then open the UI (screenshot: `docs/images/onboarding-1.png` — TBD).

One command should get you to a working chat. If it doesn't, run doctor next.

## If it fails

```bash
oss-bot doctor
```

1. Read the failed check.
2. Follow [Runbook § Startup failure](docs/runbook-oncall.md#startup-failure).
3. Still stuck → [open a doctor Issue](https://github.com/Aero123421/oss-bot/issues/new?template=doctor.yml) with the **exact command** and **full doctor output**.

## Remote access

See [Remote access](docs/remote-access.md) for exposing the local instance safely and recovering when the link drops.

## Architecture

See [Architecture](docs/architecture.md) for components and boundaries.

## Docs

| Doc | Purpose |
| --- | --- |
| [README (日本語)](README.ja.md) | Same guide in Japanese |
| [Architecture](docs/architecture.md) | System outline |
| [Remote access](docs/remote-access.md) | Remote / reconnect |
| [On-call runbook](docs/runbook-oncall.md) | First-line triage |

## Contributing

Use the Issue templates (`bug` / `feature` / `doctor`). PRs against `main` only.
