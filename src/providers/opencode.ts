import { createCliProvider } from "./cliProvider.js";
import { registerProvider } from "./registryCore.js";

const adapter = createCliProvider({
  id: "opencode",
  purpose: "provider:opencode",
  binaryHints: ["opencode"],
  binEnvKey: "OPENCODE_BIN",
  buildArgs: (c) => [c],
});

registerProvider(adapter);

export async function runOpencodeForThread(input: {
  threadId: string;
  botId: string;
  content: string;
}): Promise<void> {
  return adapter.run(input);
}

export default adapter;
