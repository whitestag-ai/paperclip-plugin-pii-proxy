import { describe, it, expect, vi } from "vitest";
import {
  handleBeforeAdapterExecute,
  type PluginConfig,
  type HookInput,
} from "../src/hook-logic.js";

function mkInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    agentId: "agent-1",
    companyId: "co-1",
    runId: "run-1",
    adapterType: "claude_local",
    runtimeConfig: {},
    adapterEnv: {},
    context: {},
    ...overrides,
  };
}

function mkConfig(overrides: Partial<PluginConfig> = {}): PluginConfig {
  return {
    dpoUrl: "http://localhost:4711",
    defaultMode: "default-on",
    providers: ["anthropic"],
    healthCheckTimeoutMs: 100,
    ...overrides,
  };
}

function healthyFetch(): typeof fetch {
  return vi.fn().mockImplementation(async () =>
    new Response(JSON.stringify({ status: "ok", classifier: "reachable" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

function unreachableFetch(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
}

describe("handleBeforeAdapterExecute", () => {
  it("returns no changes for local adapter (lmstudio_local)", async () => {
    const fetchFn = vi.fn();
    const result = await handleBeforeAdapterExecute(
      mkInput({ adapterType: "lmstudio_local" }),
      mkConfig({ defaultMode: "required" }),
      { fetchFn: fetchFn as unknown as typeof fetch },
    );
    expect(result).toEqual({});
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns no changes for unknown adapter type", async () => {
    const fetchFn = vi.fn();
    const result = await handleBeforeAdapterExecute(
      mkInput({ adapterType: "something-unknown" }),
      mkConfig(),
      { fetchFn: fetchFn as unknown as typeof fetch },
    );
    expect(result).toEqual({});
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("injects ANTHROPIC_BASE_URL for claude_local in default-on mode", async () => {
    const fetchFn = healthyFetch();
    const result = await handleBeforeAdapterExecute(
      mkInput({ adapterType: "claude_local" }),
      mkConfig({ defaultMode: "default-on" }),
      { fetchFn },
    );
    expect(result.env).toEqual({
      ANTHROPIC_BASE_URL: "http://localhost:4711/anthropic",
    });
    expect(result.block).toBeUndefined();
  });

  it("skips injection in default-off mode (no per-agent override)", async () => {
    const fetchFn = vi.fn();
    const result = await handleBeforeAdapterExecute(
      mkInput({ adapterType: "claude_local" }),
      mkConfig({ defaultMode: "default-off" }),
      { fetchFn: fetchFn as unknown as typeof fetch },
    );
    expect(result).toEqual({});
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("honors per-agent opt-in in default-off mode", async () => {
    const fetchFn = healthyFetch();
    const result = await handleBeforeAdapterExecute(
      mkInput({ adapterEnv: { PAPERCLIP_PII_PROXY: "enabled" } }),
      mkConfig({ defaultMode: "default-off" }),
      { fetchFn },
    );
    expect(result.env).toEqual({
      ANTHROPIC_BASE_URL: "http://localhost:4711/anthropic",
    });
  });

  it("honors per-agent opt-out in default-on mode", async () => {
    const fetchFn = vi.fn();
    const result = await handleBeforeAdapterExecute(
      mkInput({ adapterEnv: { PAPERCLIP_PII_PROXY: "disabled" } }),
      mkConfig({ defaultMode: "default-on" }),
      { fetchFn: fetchFn as unknown as typeof fetch },
    );
    expect(result).toEqual({});
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("ignores per-agent opt-out in required mode (policy wins)", async () => {
    const fetchFn = healthyFetch();
    const result = await handleBeforeAdapterExecute(
      mkInput({ adapterEnv: { PAPERCLIP_PII_PROXY: "disabled" } }),
      mkConfig({ defaultMode: "required" }),
      { fetchFn },
    );
    expect(result.env).toEqual({
      ANTHROPIC_BASE_URL: "http://localhost:4711/anthropic",
    });
  });

  it("blocks the run when DPO is unreachable in required mode", async () => {
    const fetchFn = unreachableFetch();
    const result = await handleBeforeAdapterExecute(
      mkInput(),
      mkConfig({ defaultMode: "required" }),
      { fetchFn },
    );
    expect(result.block).toBeDefined();
    expect(result.block!.reason).toBe("pii_proxy_unreachable");
    expect(result.block!.message).toMatch(/required-mode/);
    expect(result.env).toBeUndefined();
  });

  it("proceeds without protection when DPO unreachable in default-on (fail-open by policy)", async () => {
    const fetchFn = unreachableFetch();
    const logged: Array<{ level: string; message: string }> = [];
    const result = await handleBeforeAdapterExecute(
      mkInput(),
      mkConfig({ defaultMode: "default-on" }),
      {
        fetchFn,
        log: (level, message) => logged.push({ level, message }),
      },
    );
    expect(result).toEqual({});
    expect(logged.some((l) => l.level === "warn" && /unreachable/.test(l.message))).toBe(true);
  });

  it("ignores disabled providers in the config", async () => {
    const fetchFn = vi.fn();
    const result = await handleBeforeAdapterExecute(
      mkInput({ adapterType: "claude_local" }),
      mkConfig({ providers: ["openai"] }), // anthropic not listed
      { fetchFn: fetchFn as unknown as typeof fetch },
    );
    expect(result).toEqual({});
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("normalises dpoUrl with trailing slash correctly", async () => {
    const fetchFn = healthyFetch();
    const result = await handleBeforeAdapterExecute(
      mkInput(),
      mkConfig({ dpoUrl: "http://localhost:4711/" }),
      { fetchFn },
    );
    expect(result.env).toEqual({
      ANTHROPIC_BASE_URL: "http://localhost:4711/anthropic",
    });
  });

  it("does NOT inject anything when classifier reports unreachable (fail-open in default-on, block in required)", async () => {
    const halfHealthyFetch = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ status: "ok", classifier: "unreachable" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    // default-on: fail-open (no env, no block)
    const r1 = await handleBeforeAdapterExecute(
      mkInput(),
      mkConfig({ defaultMode: "default-on" }),
      { fetchFn: halfHealthyFetch as unknown as typeof fetch },
    );
    expect(r1).toEqual({});
    // required: block
    const r2 = await handleBeforeAdapterExecute(
      mkInput(),
      mkConfig({ defaultMode: "required" }),
      { fetchFn: halfHealthyFetch as unknown as typeof fetch },
    );
    expect(r2.block?.reason).toBe("pii_proxy_unreachable");
  });
});
