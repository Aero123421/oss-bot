import { createCliProvider } from "./cliProvider.js";
import { registerProvider } from "./registryCore.js";

const adapter = createCliProvider({
  id: "kimi",
  purpose: "provider:kimi",
  binaryHints: ["kimi"],
  binEnvKey: "KIMI_BIN",
  buildArgs: (c) => [c],
});

registerProvider(adapter);

export async function runKimiForThread(input: {
  threadId: string;
  botId: string;
  content: string;
}): Promise<void> {
  return adapter.run(input);
}

export default adapter;
