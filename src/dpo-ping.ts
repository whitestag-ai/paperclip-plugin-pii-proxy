/**
 * Thin reachability check against the pii-proxy server's /health endpoint.
 * Returns true iff the server is reachable within the given timeout AND its
 * classifier reports "reachable" (i.e. anonymisation will actually work).
 *
 * The check is deliberately cheap so we can run it before every agent
 * heartbeat that requires a cloud LLM call. For `required` mode, a
 * failing check means the run is blocked.
 */

export interface PingDpoInput {
  dpoUrl: string;
  /** Optional shared key — some deployments require it for /health too. */
  sharedKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface PingDpoResult {
  reachable: boolean;
  /** Present on failure — short description for log output. */
  reason?: string;
}

export async function pingDpo(input: PingDpoInput): Promise<PingDpoResult> {
  const timeoutMs = input.timeoutMs ?? 2000;
  const fetchFn = input.fetchFn ?? fetch;
  const url = new URL("/health", input.dpoUrl).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (input.sharedKey) headers["x-pii-proxy-key"] = input.sharedKey;
    const res = await fetchFn(url, { method: "GET", headers, signal: controller.signal });
    if (!res.ok) {
      return { reachable: false, reason: `http_${res.status}` };
    }
    let body: { status?: string; classifier?: string };
    try {
      body = (await res.json()) as { status?: string; classifier?: string };
    } catch (err) {
      return { reachable: false, reason: "invalid_json" };
    }
    if (body.status !== "ok") {
      return { reachable: false, reason: `status_${body.status ?? "unknown"}` };
    }
    if (body.classifier !== "reachable") {
      return {
        reachable: false,
        reason: `classifier_${body.classifier ?? "unknown"}`,
      };
    }
    return { reachable: true };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { reachable: false, reason: "timeout" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { reachable: false, reason: `fetch_error:${message}` };
  } finally {
    clearTimeout(timer);
  }
}
