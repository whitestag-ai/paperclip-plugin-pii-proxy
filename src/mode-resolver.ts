/**
 * Resolves the effective pii-proxy mode for a single agent run.
 *
 * Inputs:
 *   - `defaultMode` — plugin-install config: "required" | "default-on" | "default-off"
 *   - `agentOverride` — per-agent opt-in/out signal from adapterEnv:
 *       `PAPERCLIP_PII_PROXY=enabled` / `=disabled` / unset
 *
 * Semantics:
 *   - `required` mode can NOT be disabled per-agent (policy overrides
 *     individual preference — safest for compliance).
 *   - In `default-on`, agents may set `disabled` to opt out.
 *   - In `default-off`, agents must set `enabled` to opt in.
 *   - Unknown override values are treated as "no override" (use default).
 */

export type DefaultMode = "required" | "default-on" | "default-off";
export type EffectiveMode = "required" | "enabled" | "disabled";
export type AgentOverride = "enabled" | "disabled" | null;

export interface ResolveEffectiveModeInput {
  defaultMode: DefaultMode;
  agentOverride: AgentOverride;
}

export function resolveEffectiveMode(input: ResolveEffectiveModeInput): EffectiveMode {
  if (input.defaultMode === "required") {
    // No opt-out allowed.
    return "required";
  }
  if (input.agentOverride === "enabled") return "enabled";
  if (input.agentOverride === "disabled") return "disabled";
  return input.defaultMode === "default-on" ? "enabled" : "disabled";
}

const OVERRIDE_ENV_VAR = "PAPERCLIP_PII_PROXY";

/**
 * Read the per-agent opt-in/out signal from the adapter's resolved env.
 * Returns `null` if unset or has an unrecognized value.
 */
export function readAgentOverride(adapterEnv: Record<string, string>): AgentOverride {
  const raw = adapterEnv[OVERRIDE_ENV_VAR];
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "enabled" || v === "on" || v === "1" || v === "true") return "enabled";
  if (v === "disabled" || v === "off" || v === "0" || v === "false") return "disabled";
  return null;
}

export const _OVERRIDE_ENV_VAR = OVERRIDE_ENV_VAR;
