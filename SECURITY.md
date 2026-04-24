# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in
`@whitestag/paperclip-plugin-pii-proxy`, please **do not open a public
issue**. Report privately via GitHub's security advisory workflow:

  https://github.com/whitestag-ai/paperclip-plugin-pii-proxy/security/advisories/new

Or email: whitestagvr@gmail.com

Please include:
- Plugin version + Paperclip host version
- Minimal reproducer
- Expected vs. actual behaviour
- Your assessment of severity and impact

We aim to respond within 3 working days. Fixes that affect published
releases go out under a coordinated-disclosure schedule — typically a
patch release + GitHub security advisory within 7 days of confirmation.

## Threat model

**In scope** — issues where this plugin's behaviour can:

- Leak PII to an upstream cloud LLM despite the user intending protection
  (e.g. a bug where `required` mode proceeds without anonymisation)
- Fail-open silently instead of the configured fail-open-with-warning /
  fail-closed-on-required
- Inject env vars into an adapter run that compromise the host (e.g.
  arbitrary code execution via a crafted config)
- Expose the pii-proxy shared key to agents that should not have access
- Downgrade streaming deanonymisation so partial pseudonyms reach the
  client (see [`pii-proxy`](https://github.com/whitestag-ai/pii-proxy)
  for the deanonymiser itself)

**Out of scope** — these belong in the respective upstream projects:

- Bugs in the pii-proxy server's anonymisation or classifier logic →
  [`whitestag-ai/pii-proxy`](https://github.com/whitestag-ai/pii-proxy/security)
- Paperclip host-side vulnerabilities (plugin-sdk, worker manager,
  heartbeat) → the main Paperclip project's security process
- Claude Code CLI or Codex CLI vulnerabilities → the respective vendors
- Misconfiguration of the pii-proxy by the operator (e.g. running on a
  public interface without a shared key)

## Supported versions

Only the latest minor release on `main` gets security fixes. During the
pre-1.0 phase, users should stay on the latest 0.x published version.

## Hardening recommendations for operators

- Run the pii-proxy on `127.0.0.1` (the default). Only expose it on a
  trusted LAN interface when multiple hosts need it, and always gate it
  with the shared key.
- Set `defaultMode: required` for production companies. `default-on` /
  `default-off` are for development.
- Keep the `DPO_DEBUG_TRAIL` env var OFF in production. It writes
  plaintext prompts/responses to disk by design.
- Rotate the pii-proxy shared key if a plugin-host process (or any other
  client that held the key) is compromised.
