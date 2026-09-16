import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { CredGrant, CredGrantStatus, ProviderCredSpec, ProviderId } from "../types.js";
import { registerAllCredAdapters } from "./register.js";

function expandHost(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  if (p === "~") return os.homedir();
  return p;
}

function binaryInstalled(hints: string[]): boolean {
  for (const name of hints) {
    const r = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return true;
  }
  return false;
}

export class CredBroker {
  private specs = new Map<string, ProviderCredSpec>();

  register(spec: ProviderCredSpec): void {
    this.specs.set(spec.purpose, spec);
  }

  listSpecs(): ProviderCredSpec[] {
    return [...this.specs.values()];
  }

  /**
   * Public status only — NEVER returns secret values.
   * HTTP routes may expose this. Do NOT expose `issue()` grants over HTTP.
   */
  status(purpose: string): CredGrantStatus {
    const spec = this.specs.get(purpose);
    if (!spec) {
      return {
        purpose,
        provider: purpose.replace(/^provider:/, "") as ProviderId,
        present: false,
        mountsOk: false,
        envOk: false,
        installed: false,
        status_code: "not_registered",
        hint: `No ProviderCredAdapter registered for ${purpose}`,
      };
    }

    const mountsOk =
      spec.mounts.length === 0 ||
      spec.mounts.some((m) => fs.existsSync(expandHost(m.host)));
    const envOk =
      spec.envKeys.length === 0
        ? false
        : spec.envKeys.some((k) => Boolean(process.env[k]?.trim()));
    // If no env keys declared, auth is mount-only
    const authOk =
      spec.envKeys.length === 0 ? mountsOk : mountsOk || envOk;
    const installed = binaryInstalled(spec.binaryHints);

    if (!installed) {
      return {
        purpose,
        provider: spec.provider,
        present: false,
        mountsOk,
        envOk,
        installed: false,
        status_code: "not_installed",
        hint: spec.missingHint,
      };
    }

    if (!authOk) {
      return {
        purpose,
        provider: spec.provider,
        present: false,
        mountsOk,
        envOk,
        installed: true,
        status_code: "missing",
        hint: spec.missingHint,
      };
    }

    return {
      purpose,
      provider: spec.provider,
      present: true,
      mountsOk,
      envOk: spec.envKeys.length === 0 ? mountsOk : envOk,
      installed: true,
      status_code: "ready",
      hint:
        mountsOk && !envOk && spec.envKeys.length > 0
          ? "host mount present; optional env token absent"
          : !mountsOk && envOk
            ? "env token present; host mount path missing (ok for local)"
            : undefined,
    };
  }

  /**
   * In-memory CredGrant for Runtime/Provider injection ONLY.
   * FORBIDDEN: serialize this object (especially `env`) into HTTP JSON, logs, Bus payloads, or DB.
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
registerAllCredAdapters(credBroker);
