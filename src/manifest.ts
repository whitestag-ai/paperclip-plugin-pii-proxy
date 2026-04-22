import { definePlugin } from "@paperclipai/plugin-sdk";

export default definePlugin({
  id: "pii-proxy",
  name: "pii-proxy",
  version: "0.1.0",
  description: "GDPR-compliant anonymisation gate for LLM calls via pii-proxy server",
  settings: {
    baseUrl: {
      type: "string",
      default: "http://localhost:4711",
      description: "pii-proxy server URL",
    },
    sharedKey: {
      type: "secret",
      description: "Shared secret for X-PII-Proxy-Key header",
    },
  },
});
