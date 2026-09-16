# Architecture (skeleton)

Status: placeholder until implementation lands.

## Goals

- On-prem / self-hosted by default
- One-command bootstrap + `doctor` for install health
- Optional remote access without changing the local core

## Components (TBD)

| Component | Role |
| --- | --- |
| CLI / installer | Bootstrap, `doctor`, start/stop |
| Agent runtime | Chat / tool loop |
| Local UI | First-run onboarding |
| Remote gateway | Optional expose / reconnect (see remote-access) |

## Boundaries

- Secrets stay on the host; remote path must not require shipping credentials into docs or Issues.
- Doctor checks are the single source of install truth (README and runbook both point here).

## Open questions

- Final install entrypoint (`curl \| bash` vs CLI package)
- Process model (single binary vs compose)
