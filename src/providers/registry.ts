export { registerProvider, getProvider, listProviders } from "./registryCore.js";
export { threadEvents } from "./cliProvider.js";

/** Side-effect imports — each Provider Adapter file registers itself. */
import "./claude.js";
import "./codex.js";
import "./opencode.js";
import "./agy.js";
import "./pi.js";
import "./kimi.js";
import "./grok.js";
