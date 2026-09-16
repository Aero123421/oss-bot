import os from "node:os";
import path from "node:path";
import type { ProviderCredSpec } from "../../types.js";

export function kimiCredSpec(): ProviderCredSpec {
  const host =
    process.env.KIMI_HOME?.trim() ||
    path.join(os.homedir(), ".kimi", "credentials");
  return {
    provider: "kimi",
    purpose: "provider:kimi",
    mounts: [{ host, container: "/home/node/.kimi/credentials", mode: "ro" }],
    envKeys: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
    binaryHints: ["kimi"],
    missingHint: "Install kimi CLI; run kimi login (~/.kimi/credentials) or set MOONSHOT_API_KEY",
  };
}
