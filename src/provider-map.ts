/**
 * Maps Paperclip adapter types to the provider-specific proxy setup.
 *
 * `envVar`   — the env variable the adapter subprocess reads to choose its
 *              upstream base URL.
 * `path`     — the sub-path on the pii-proxy server where the provider's
 *              passthrough route lives.
 * `provider` — stable id matching the `providers` manifest enum.
 *
 * Adapters not listed here (lmstudio_local, ollama-style, http with a user
 * URL, openclaw_gateway) are intentionally NOT intercepted — they either
 * run locally (no PII egress) or need a dedicated design (WebSocket, ...).
 */
export interface AdapterProviderMapping {
  envVar: string;
  path: string;
  provider: string;
}

const DEFAULT_MAP: Record<string, AdapterProviderMapping> = {
  claude_local: {
    envVar: "ANTHROPIC_BASE_URL",
    path: "/anthropic",
    provider: "anthropic",
  },
  // Phase 2 — OpenAI:
  // codex_local: { envVar: "OPENAI_BASE_URL", path: "/openai/v1", provider: "openai" },
};

export function resolveAdapterProviderMapping(
  adapterType: string,
  enabledProviders: readonly string[],
): AdapterProviderMapping | null {
  const entry = DEFAULT_MAP[adapterType];
  if (!entry) return null;
  if (!enabledProviders.includes(entry.provider)) return null;
  return entry;
}

/** Exposed for tests. */
export const _ADAPTER_PROVIDER_MAP = DEFAULT_MAP;
