import type { CredBroker } from "./broker.js";
import { claudeCredSpec } from "./adapters/claude.js";
import { codexCredSpec } from "./adapters/codex.js";
import { opencodeCredSpec } from "./adapters/opencode.js";
import { agyCredSpec } from "./adapters/agy.js";
import { piCredSpec } from "./adapters/pi.js";
import { kimiCredSpec } from "./adapters/kimi.js";
import { grokCredSpec } from "./adapters/grok.js";

/** Register all BYO ProviderCredAdapters — add providers here, never in core if-chains */
export function registerAllCredAdapters(broker: CredBroker): void {
  for (const spec of [
    claudeCredSpec(),
    codexCredSpec(),
    opencodeCredSpec(),
    agyCredSpec(),
    piCredSpec(),
    kimiCredSpec(),
    grokCredSpec(),
  ]) {
    broker.register(spec);
  }
}
