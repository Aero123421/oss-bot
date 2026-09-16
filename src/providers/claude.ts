export { threadEvents } from "./registry.js";
import { getProvider } from "./registry.js";
import type { ProviderRunInput } from "./cliProvider.js";

/** @deprecated use getProvider('claude') — kept for import compatibility */
export async function runClaudeForThread(input: ProviderRunInput): Promise<void> {
  const p = getProvider("claude");
  if (!p) throw new Error("claude provider not registered");
  return p.run(input);
}
