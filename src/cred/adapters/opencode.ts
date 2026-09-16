import os from "node:os";
import path from "node:path";
import type { ProviderCredSpec } from "../../types.js";

export function opencodeCredSpec(): ProviderCredSpec {
  const host =
    process.env.OPENCODE_DATA_HOST?.trim() ||
    path.join(os.homedir(), ".local", "share", "opencode");
  return {
    provider: "opencode",
    purpose: "provider:opencode",
    mounts: [{ host, container: "/home/node/.local/share/opencode", mode: "ro" }],
    envKeys: [],
    binaryHints: ["opencode"],
    missingHint: "Install OpenCode; login so ~/.local/share/opencode exists",
  };
}
