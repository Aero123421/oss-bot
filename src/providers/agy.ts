import { createCliProvider } from "./cliProvider.js";
import { registerProvider } from "./registryCore.js";

const adapter = createCliProvider({
  id: "agy",
  purpose: "provider:agy",
  binaryHints: ["agy", "opencode"],
  binEnvKey: "AGY_BIN",
  buildArgs: (c) => [c],
});

registerProvider(adapter);

export async function runAgyForThread(input: {
  threadId: string;
  botId: string;
  content: string;
}): Promise<void> {
  return adapter.run(input);
}

export default adapter;
