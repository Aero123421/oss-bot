import { createCliProvider } from "./cliProvider.js";
import { registerProvider } from "./registryCore.js";

const adapter = createCliProvider({
  id: "pi",
  purpose: "provider:pi",
  binaryHints: ["pi"],
  binEnvKey: "PI_BIN",
  buildArgs: (c) => [c],
});

registerProvider(adapter);

export async function runPiForThread(input: {
  threadId: string;
  botId: string;
  content: string;
}): Promise<void> {
  return adapter.run(input);
}

export default adapter;
