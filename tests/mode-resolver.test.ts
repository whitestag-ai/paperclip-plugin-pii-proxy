import { describe, it, expect } from "vitest";
import { resolveEffectiveMode, readAgentOverride } from "../src/mode-resolver.js";

describe("resolveEffectiveMode", () => {
  it("required mode is immune to per-agent override", () => {
    expect(
      resolveEffectiveMode({ defaultMode: "required", agentOverride: null }),
    ).toBe("required");
    expect(
      resolveEffectiveMode({ defaultMode: "required", agentOverride: "disabled" }),
    ).toBe("required");
    expect(
      resolveEffectiveMode({ defaultMode: "required", agentOverride: "enabled" }),
    ).toBe("required");
  });

  it("default-on + no override = enabled", () => {
    expect(
      resolveEffectiveMode({ defaultMode: "default-on", agentOverride: null }),
    ).toBe("enabled");
  });

  it("default-on + disabled override = disabled", () => {
    expect(
      resolveEffectiveMode({ defaultMode: "default-on", agentOverride: "disabled" }),
    ).toBe("disabled");
  });

  it("default-off + no override = disabled", () => {
    expect(
      resolveEffectiveMode({ defaultMode: "default-off", agentOverride: null }),
    ).toBe("disabled");
  });

  it("default-off + enabled override = enabled", () => {
    expect(
      resolveEffectiveMode({ defaultMode: "default-off", agentOverride: "enabled" }),
    ).toBe("enabled");
  });
});

describe("readAgentOverride", () => {
  it("returns null for unset env", () => {
    expect(readAgentOverride({})).toBeNull();
  });

  it("parses standard enabled/disabled", () => {
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "enabled" })).toBe("enabled");
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "disabled" })).toBe("disabled");
  });

  it("accepts boolean-ish aliases (1/0, true/false, on/off)", () => {
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "1" })).toBe("enabled");
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "0" })).toBe("disabled");
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "true" })).toBe("enabled");
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "false" })).toBe("disabled");
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "on" })).toBe("enabled");
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "off" })).toBe("disabled");
  });

  it("normalizes case + whitespace", () => {
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "  ENABLED " })).toBe("enabled");
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "Disabled" })).toBe("disabled");
  });

  it("returns null for garbage values (not a silent fallback)", () => {
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "yes please" })).toBeNull();
    expect(readAgentOverride({ PAPERCLIP_PII_PROXY: "" })).toBeNull();
  });
});
