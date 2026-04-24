# @whitestag/paperclip-plugin-pii-proxy

Paperclip plugin that routes external LLM calls through a local [pii-proxy](https://github.com/whitestag-ai/pii-proxy) server for GDPR-compliant anonymisation.

**Why:** If you run Paperclip agents that talk to Anthropic, OpenAI, or other cloud LLMs, this plugin pseudonymises personal and company data (names, emails, addresses, bank details, trade secrets) **before** the prompt leaves your machine — and deanonymises the response transparently on the way back. Art. 9 data is blocked entirely (fail-closed).

**Status:** `0.1.x` — Anthropic (via `claude_local` adapter) is the first supported provider. OpenAI (Codex-CLI) follows in `0.2.x`.

## How it works

Paperclip's `claude_local` adapter spawns the Claude Code CLI as a subprocess. The CLI honours `ANTHROPIC_BASE_URL` for its API target. This plugin uses Paperclip's `onBeforeAdapterExecute` hook to set that env var to your local pii-proxy's Anthropic passthrough — so the agent, the CLI, and the upstream API all keep working unchanged, while every byte of prompt text is pseudonymised at the proxy before egress.

```
Paperclip agent heartbeat
  └── claude_local adapter
        └── spawns `claude` CLI with ANTHROPIC_BASE_URL=http://localhost:4711/anthropic
              └── CLI calls /v1/messages on the pii-proxy
                    ├── pii-proxy anonymises → api.anthropic.com
                    ├── pii-proxy streams the response back, deanonymising per token
                    └── CLI sees the real names in the final answer
```

Local adapters (`lmstudio_local`, `ollama`, …) are **never** touched — PII never leaves the host in those cases, so no interception is needed.

## Install

```bash
paperclip plugin install @whitestag/paperclip-plugin-pii-proxy
```

Then configure via the plugin settings:

| Setting | Description | Default |
|---|---|---|
| `dpoUrl` | URL of your running pii-proxy server | `http://localhost:4711` |
| `sharedKey` | Shared key for DPO health checks (optional for passthrough, required for `/anonymize` etc.) | — |
| `defaultMode` | `required` \| `default-on` \| `default-off` | `default-off` |
| `providers` | List of providers to intercept | `["anthropic"]` |
| `healthCheckTimeoutMs` | Timeout for the pre-flight reachability check | `2000` |

### Modes

| Mode | Behaviour |
|---|---|
| **`required`** | Every supported cloud agent MUST go through the pii-proxy. If the proxy is unreachable, the run is **blocked** with a `pii_proxy_unreachable` error. Individual agents cannot opt out. Safest for production. |
| **`default-on`** | All cloud agents route through by default. Agents may opt out by setting `PAPERCLIP_PII_PROXY=disabled` in their adapter env. If the proxy is unreachable, the run **proceeds unprotected with a warning** (fail-open). |
| **`default-off`** | Agents opt in explicitly via `PAPERCLIP_PII_PROXY=enabled` in their adapter env. Default after install — you must actively turn the plugin on per agent. |

### Per-agent opt-in/out

Set in the agent's `adapterConfig.env`:

- `PAPERCLIP_PII_PROXY=enabled` — force-enable even in `default-off`
- `PAPERCLIP_PII_PROXY=disabled` — opt out (ignored in `required` mode)

## Architecture

- **`onBeforeAdapterExecute`** — Paperclip plugin hook (added in Paperclip `0.3.x`). Invoked once per agent run, just before the adapter subprocess is spawned.
- **Provider mapping** — Maps `claude_local → ANTHROPIC_BASE_URL → /anthropic`. Future: `codex_local → OPENAI_BASE_URL → /openai/v1`.
- **Pre-flight reachability check** — Every run does a cheap `/health` ping on the pii-proxy. Short-circuits block/fall-open behaviour.

## Local development

```bash
pnpm install
pnpm build     # tsc + emits manifest.json
pnpm test      # 30 unit tests
```

## License

Apache-2.0 © WHITESTAG.AI
