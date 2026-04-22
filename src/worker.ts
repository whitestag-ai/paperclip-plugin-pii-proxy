import { createPiiProxyClient } from "@whitestag-ai/pii-proxy-core";

export async function initialize(settings: { baseUrl: string; sharedKey: string }) {
  const client = createPiiProxyClient(settings);
  const health = await client.health();
  if (health.classifier !== "reachable") {
    throw new Error("pii-proxy classifier is not reachable");
  }
  return client;
}
