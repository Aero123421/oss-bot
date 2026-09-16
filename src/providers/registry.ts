import type { ProviderId } from "../types.js";
import {
  createCliProvider,
  type ProviderRunInput,
  threadEvents,
} from "./cliProvider.js";

export type ProviderAdapter = {
  id: ProviderId;
  run: (input: ProviderRunInput) => Promise<void>;
};

const adapters = new Map<ProviderId, ProviderAdapter>();

export function registerProvider(adapter: ProviderAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getProvider(id: ProviderId): ProviderAdapter | undefined {
  return adapters.get(id);
}

export function listProviders(): ProviderAdapter[] {
  return [...adapters.values()];
}

export { threadEvents };

/** Register all BYO CLI providers — extend by adding registrations, not core switches */
function buildArgsPrompt(content: string): string[] {
  return ["-p", content, "--output-format", "text"];
}
function buildArgsPositional(content: string): string[] {
  return [content];
}

registerProvider(
  createCliProvider({
    id: "claude",
    purpose: "provider:claude",
    binaryHints: ["claude", "claude-code"],
    binEnvKey: "CLAUDE_BIN",
    buildArgs: buildArgsPrompt,
  })
);
registerProvider(
  createCliProvider({
    id: "codex",
    purpose: "provider:codex",
    binaryHints: ["codex"],
    binEnvKey: "CODEX_BIN",
    buildArgs: (c) => ["exec", c],
  })
);
registerProvider(
  createCliProvider({
    id: "opencode",
    purpose: "provider:opencode",
    binaryHints: ["opencode"],
    binEnvKey: "OPENCODE_BIN",
    buildArgs: buildArgsPositional,
  })
);
registerProvider(
  createCliProvider({
    id: "agy",
    purpose: "provider:agy",
    binaryHints: ["agy", "opencode"],
    binEnvKey: "AGY_BIN",
    buildArgs: buildArgsPositional,
  })
);
registerProvider(
  createCliProvider({
    id: "pi",
    purpose: "provider:pi",
    binaryHints: ["pi"],
    binEnvKey: "PI_BIN",
    buildArgs: buildArgsPositional,
  })
);
registerProvider(
  createCliProvider({
    id: "kimi",
    purpose: "provider:kimi",
    binaryHints: ["kimi"],
    binEnvKey: "KIMI_BIN",
    buildArgs: buildArgsPositional,
  })
);
registerProvider(
  createCliProvider({
    id: "grok",
    purpose: "provider:grok",
    binaryHints: ["grok"],
    binEnvKey: "GROK_BIN",
    buildArgs: buildArgsPositional,
  })
);
