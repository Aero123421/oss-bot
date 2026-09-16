import os from "node:os";
import path from "node:path";
import type { ProviderCredSpec } from "../../types.js";

export function claudeCredSpec(): ProviderCredSpec {
  const hostClaude =
    process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(os.homedir(), ".claude");
  return {
    provider: "claude",
    purpose: "provider:claude",
    mounts: [{ host: hostClaude, container: "/home/node/.claude", mode: "ro" }],
    envKeys: ["CLAUDE_CODE_OAUTH_TOKEN"],
    binaryHints: ["claude", "claude-code"],
    missingHint: "Install Claude Code and login on host (~/.claude) or set CLAUDE_CODE_OAUTH_TOKEN",
  };
}
