import os from "node:os";
import path from "node:path";
import type { ProviderCredSpec } from "../../types.js";

export function grokCredSpec(): ProviderCredSpec {
  const host =
    process.env.GROK_HOME?.trim() || path.join(os.homedir(), ".grok");
  return {
    provider: "grok",
    purpose: "provider:grok",
    mounts: [{ host, container: "/home/node/.grok", mode: "ro" }],
    envKeys: ["XAI_API_KEY", "GROK_API_KEY"],
    binaryHints: ["grok"],
    missingHint: "Install grok CLI; ~/.grok/auth.json or XAI_API_KEY / grok login",
  };
}
