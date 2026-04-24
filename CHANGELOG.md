# @whitestag/paperclip-plugin-pii-proxy

## 0.1.0

Initial release. Anthropic-only, non-UI, host-side routing plugin.

### Features

- `onBeforeAdapterExecute` hook integration (requires Paperclip host with
  plugin-hook support, i.e. the minor release containing
  `HOST_TO_WORKER_OPTIONAL_METHODS.includes("beforeAdapterExecute")`).
- `claude_local` adapter gets `ANTHROPIC_BASE_URL` injected to route every
  Claude Code CLI call through the configured pii-proxy Anthropic passthrough.
- Three modes: `required` (no opt-out, block on unreachable),
  `default-on` (opt-out via `PAPERCLIP_PII_PROXY=disabled`, fail-open),
  `default-off` (opt-in via `PAPERCLIP_PII_PROXY=enabled`).
- Pre-flight `/health` ping with configurable timeout — blocks
  runs in `required` mode when the pii-proxy or its classifier is down.
- 30 unit tests (mode resolver 10, dpo-ping 8, hook logic 12).

### Limitations

- Only `claude_local` is supported. OpenAI (`codex_local`) follows once
  the pii-proxy server ships its `/openai/v1/chat/completions` passthrough.
- No UI yet — configure via `paperclip plugin configure` CLI. UI
  settings panel comes with Phase 3.
- Streaming is supported end-to-end (pii-proxy server handles SSE
  deanonymisation) but requires pii-proxy ≥ 0.3.0.
- Tool-use `input_json_delta` payloads pass through unchanged —
  tool-call anonymisation is a Phase 4 item.

## Unreleased

Nothing yet.
