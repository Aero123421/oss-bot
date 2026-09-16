import os from "node:os";
import path from "node:path";
import type { ProviderCredSpec } from "../../types.js";

export function codexCredSpec(): ProviderCredSpec {
  const host =
    process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
  return {
    provider: "codex",
    purpose: "provider:codex",
    mounts: [{ host, container: "/home/node/.codex", mode: "ro" }],
    envKeys: ["OPENAI_API_KEY", "CODEX_API_KEY"],
    binaryHints: ["codex"],
    missingHint: "Install Codex CLI; use file-store auth under CODEX_HOME (~/.codex)",
  };
}
