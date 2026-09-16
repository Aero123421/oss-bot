import os from "node:os";
import path from "node:path";
import type { ProviderCredSpec } from "../../types.js";

/** agy auth typically rides OpenCode accounts/plugin paths */
export function agyCredSpec(): ProviderCredSpec {
  const host =
    process.env.AGY_DATA_HOST?.trim() ||
    process.env.OPENCODE_DATA_HOST?.trim() ||
    path.join(os.homedir(), ".local", "share", "opencode");
  return {
    provider: "agy",
    purpose: "provider:agy",
    mounts: [{ host, container: "/home/node/.local/share/opencode", mode: "ro" }],
    envKeys: ["AGY_API_KEY"],
    binaryHints: ["agy", "opencode"],
    missingHint: "Install agy (or opencode+agy); declare auth under OpenCode data dir",
  };
}
