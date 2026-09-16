import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CredGrant, CredGrantStatus, ProviderCredSpec } from "../types.js";
import { claudeCredSpec } from "./adapters/claude.js";

function expandHost(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  if (p === "~") return os.homedir();
  return p;
}

export class CredBroker {
  private specs = new Map<string, ProviderCredSpec>();

  register(spec: ProviderCredSpec): void {
    this.specs.set(spec.purpose, spec);
  }

  /** Public status only — never returns secret values */
  status(purpose: string): CredGrantStatus {
    const spec = this.specs.get(purpose);
    if (!spec) {
      return {
        purpose,
        present: false,
        mountsOk: false,
        envOk: false,
        status_code: "not_registered",
        hint: `No ProviderCredAdapter registered for ${purpose}`,
      };
    }

    const mountsOk = spec.mounts.every((m) =>
      fs.existsSync(expandHost(m.host))
    );
    const envOk =
      spec.envKeys.length === 0 ||
      spec.envKeys.some((k) => Boolean(process.env[k]?.trim()));

    // Ready if mounts exist OR at least one supported env key is set
    const present = mountsOk || envOk;
    const ready = mountsOk || envOk;

    let status_code: CredGrantStatus["status_code"] = "missing";
    let hint: string | undefined;
    if (ready) {
      status_code = mountsOk && envOk ? "ready" : mountsOk || envOk ? "ready" : "partial";
      if (!mountsOk && envOk) hint = "env token present; host mount path missing (ok for local)";
      if (mountsOk && !envOk) hint = "host mount present; optional env token absent";
    } else {
      status_code = "missing";
      hint =
        "Claude not ready: login on host (~/.claude) or set CLAUDE_CODE_OAUTH_TOKEN; never paste secrets into UI";
    }

    return {
      purpose,
      present,
      mountsOk,
      envOk,
      status_code: ready ? "ready" : status_code,
      hint,
    };
  }

  /**
   * Issue in-memory CredGrant for runtime injection.
   * NEVER log env values. Mounts are declarative (docker layer applies RO bind).
   */
  issue(purpose: string, runtimeHandleId: string): CredGrant {
    const st = this.status(purpose);
    if (st.status_code !== "ready") {
      throw Object.assign(new Error(`cred_not_ready:${purpose}`), {
        code: "not_ready",
        status: st,
      });
    }
    const spec = this.specs.get(purpose)!;
    const env: Record<string, string> = {};
    for (const k of spec.envKeys) {
      const v = process.env[k];
      if (v?.trim()) env[k] = v;
    }
    return {
      purpose,
      runtimeHandleId,
      mounts: spec.mounts.map((m) => ({
        host: expandHost(m.host),
        container: m.container,
        mode: m.mode,
      })),
      env,
    };
  }
}

export const credBroker = new CredBroker();
credBroker.register(claudeCredSpec());
