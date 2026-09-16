import { createCliProvider } from "./cliProvider.js";
import { registerProvider } from "./registryCore.js";

const adapter = createCliProvider({
  id: "codex",
  purpose: "provider:codex",
  binaryHints: ["codex"],
  binEnvKey: "CODEX_BIN",
  buildArgs: (c) => ["exec", c],
});

registerProvider(adapter);

export async function runCodexForThread(input: {
  threadId: string;
  botId: string;
  content: string;
}): Promise<void> {
  return adapter.run(input);
}

export default adapter;
