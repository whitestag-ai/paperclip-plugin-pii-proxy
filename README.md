# @whitestag-ai/paperclip-plugin-pii-proxy

Paperclip plugin that routes outgoing LLM calls through a [pii-proxy](https://github.com/whitestag-ai/pii-proxy) server for GDPR-compliant anonymisation.

Requires a running pii-proxy server — see the [main project](https://github.com/whitestag-ai/pii-proxy) for install instructions.

## Install

In your Paperclip instance:

```bash
paperclip plugin install @whitestag-ai/paperclip-plugin-pii-proxy
```

Configure `baseUrl` (e.g. `http://host.docker.internal:4711`) and `sharedKey` via the plugin settings UI.

## License

Apache-2.0 © WHITESTAG.AI
