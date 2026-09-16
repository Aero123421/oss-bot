import type { ProviderId } from "../types.js";
import type { ProviderRunInput } from "./cliProvider.js";

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
