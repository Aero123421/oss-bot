import { createCliProvider } from "./cliProvider.js";
import { registerProvider } from "./registryCore.js";

const adapter = createCliProvider({
  id: "grok",
  purpose: "provider:grok",
  binaryHints: ["grok"],
  binEnvKey: "GROK_BIN",
  buildArgs: (c) => [c],
});

registerProvider(adapter);

export async function runGrokForThread(input: {
  threadId: string;
  botId: string;
  content: string;
}): Promise<void> {
  return adapter.run(input);
}

export default adapter;
