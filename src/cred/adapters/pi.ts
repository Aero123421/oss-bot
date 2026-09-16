import os from "node:os";
import path from "node:path";
import type { ProviderCredSpec } from "../../types.js";

export function piCredSpec(): ProviderCredSpec {
  const host =
    process.env.PI_HOME?.trim() || path.join(os.homedir(), ".pi");
  return {
    provider: "pi",
    purpose: "provider:pi",
    mounts: [{ host, container: "/home/node/.pi", mode: "ro" }],
    envKeys: ["PI_API_KEY"],
    binaryHints: ["pi"],
    missingHint: "Install pi CLI; set host path via PI_HOME or PI_API_KEY",
  };
}
