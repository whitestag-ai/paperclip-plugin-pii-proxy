import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "whitestag.pii-proxy";
const PLUGIN_VERSION = "0.1.0";

/**
 * Paperclip plugin that intercepts agent adapter execution and reroutes
 * external LLM calls through a local pii-proxy server for GDPR-compliant
 * pseudonymisation of personal and company data.
 *
 * How it works:
 *   The plugin registers `onBeforeAdapterExecute` (Paperclip ≥ host version
 *   with plugin-hook support). For each agent heartbeat it:
 *     1) decides whether this agent should be gated (company default + opt-out)
 *     2) for cloud adapters (claude_local, codex_local), injects the matching
 *        provider BASE URL env var pointing at the pii-proxy passthrough
 *     3) optionally blocks the run (required-mode) if the pii-proxy is down
 *
 * Local adapters (lmstudio_local, ollama-style) and unknown adapter types
 * are never touched — PII never leaves the machine in those cases.
 */
const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "PII-Proxy Gate",
  description:
    "GDPR-compliant anonymisation gate for agent LLM calls. Routes Anthropic (and soon OpenAI) traffic through a local pii-proxy so names, emails, bank details, and trade secrets never leave the continent in plaintext.",
  author: "WHITESTAG.AI",
  categories: ["workspace"],
  capabilities: [
    // No UI capabilities yet — a settings panel follows in a later release.
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    required: ["dpoUrl"],
    properties: {
      dpoUrl: {
        type: "string",
        title: "DPO / pii-proxy URL",
        description:
          "Base URL of the pii-proxy server, without trailing slash. Example: http://localhost:4711",
        default: "http://localhost:4711",
      },
      sharedKey: {
        type: "string",
        title: "Shared Key (X-PII-Proxy-Key)",
        description:
          "Shared secret for /anonymize, /deanonymize, /safe-call routes. Not required for the provider passthroughs (/anthropic/v1/messages) but recommended for reachability health checks.",
        format: "password",
      },
      defaultMode: {
        type: "string",
        title: "Default Mode",
        enum: ["required", "default-on", "default-off"],
        default: "default-off",
        description:
          "'required' — every cloud agent MUST go through the pii-proxy (run is blocked when unreachable). 'default-on' — all cloud agents go through by default, individual agents can opt out. 'default-off' — agents opt in explicitly. Defaults to off for safety after first install.",
      },
      providers: {
        type: "array",
        title: "Enabled Providers",
        items: {
          type: "string",
          enum: ["anthropic"],
        },
        default: ["anthropic"],
        description:
          "Which upstream providers to intercept. More providers (openai, gemini, ...) will be added in future pii-proxy releases.",
      },
      healthCheckTimeoutMs: {
        type: "number",
        title: "Health-Check Timeout (ms)",
        default: 2000,
        description:
          "How long to wait for the pii-proxy /health endpoint to respond before treating it as unreachable. Short timeout keeps heartbeats responsive; raise if you run the pii-proxy on a slow network.",
      },
      failClosedOnUnreachable: {
        type: "boolean",
        title: "Fail-Closed on Unreachable (default-on mode)",
        default: false,
        description:
          "When enabled, 'default-on' mode behaves like 'required' on pii-proxy outages — the run is blocked instead of falling back to a direct-to-provider call with plaintext PII. Leave off to keep legacy fall-open behavior; turn on when default-on is actually a security control. ('required' mode is always fail-closed regardless of this flag.)",
      },
    },
  },
};

export default manifest;
