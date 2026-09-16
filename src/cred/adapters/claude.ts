import os from "node:os";
import path from "node:path";
import type { ProviderCredSpec } from "../../types.js";

/** Claude Code: RO mount host ~/.claude → /home/node/.claude; env CLAUDE_CODE_OAUTH_TOKEN */
export function claudeCredSpec(): ProviderCredSpec {
  const hostClaude =
    process.env.CLAUDE_CONFIG_DIR?.trim() ||
    path.join(os.homedir(), ".claude");
  return {
    provider: "claude",
    purpose: "provider:claude",
    mounts: [
      {
        host: hostClaude,
        container: "/home/node/.claude",
        mode: "ro",
      },
    ],
    envKeys: ["CLAUDE_CODE_OAUTH_TOKEN"],
  };
}
