import { describe, it, expect, vi } from "vitest";
import { pingDpo } from "../src/dpo-ping.js";

function mkResponse(
  body: unknown,
  opts: { status?: number; delayMs?: number } = {},
): Promise<Response> {
  return new Promise((resolve) => {
    const res = new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: opts.status ?? 200,
      headers: { "content-type": "application/json" },
    });
    if (opts.delayMs) {
      setTimeout(() => resolve(res), opts.delayMs);
    } else {
      resolve(res);
    }
  });
}

describe("pingDpo", () => {
  it("reachable when /health returns status=ok + classifier=reachable", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      await mkResponse({ status: "ok", classifier: "reachable" }),
    );
    const r = await pingDpo({ dpoUrl: "http://localhost:4711", fetchFn });
    expect(r.reachable).toBe(true);
  });

  it("unreachable when classifier is not 'reachable'", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      await mkResponse({ status: "ok", classifier: "unreachable" }),
    );
    const r = await pingDpo({ dpoUrl: "http://localhost:4711", fetchFn });
    expect(r.reachable).toBe(false);
    expect(r.reason).toMatch(/classifier/);
  });

  it("unreachable when HTTP status is not 2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      await mkResponse("gateway", { status: 502 }),
    );
    const r = await pingDpo({ dpoUrl: "http://localhost:4711", fetchFn });
    expect(r.reachable).toBe(false);
    expect(r.reason).toBe("http_502");
  });

  it("unreachable on non-JSON body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      await mkResponse("<html>oops</html>"),
    );
    const r = await pingDpo({ dpoUrl: "http://localhost:4711", fetchFn });
    expect(r.reachable).toBe(false);
    expect(r.reason).toBe("invalid_json");
  });

  it("unreachable on fetch rejection", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await pingDpo({ dpoUrl: "http://localhost:4711", fetchFn });
    expect(r.reachable).toBe(false);
    expect(r.reason).toMatch(/ECONNREFUSED/);
  });

  it("passes x-pii-proxy-key header when sharedKey is provided", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      await mkResponse({ status: "ok", classifier: "reachable" }),
    );
    await pingDpo({
      dpoUrl: "http://localhost:4711",
      sharedKey: "secret-123",
      fetchFn,
    });
    const [, init] = fetchFn.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "x-pii-proxy-key": "secret-123",
    });
  });

  it("times out when the server hangs (AbortError → unreachable)", async () => {
    // fetch that never resolves until aborted
    const fetchFn: typeof fetch = (_input, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    };
    const r = await pingDpo({
      dpoUrl: "http://localhost:4711",
      timeoutMs: 50,
      fetchFn,
    });
    expect(r.reachable).toBe(false);
    expect(r.reason).toBe("timeout");
  });

  it("builds the URL correctly with + without trailing slash in base", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      await mkResponse({ status: "ok", classifier: "reachable" }),
    );
    await pingDpo({ dpoUrl: "http://localhost:4711", fetchFn });
    await pingDpo({ dpoUrl: "http://localhost:4711/", fetchFn });
    expect(fetchFn.mock.calls[0]![0]).toBe("http://localhost:4711/health");
    expect(fetchFn.mock.calls[1]![0]).toBe("http://localhost:4711/health");
  });
});
