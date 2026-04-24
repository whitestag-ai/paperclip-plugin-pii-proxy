/**
 * Pure hook-logic module — takes a BeforeAdapterExecute input and the
 * resolved plugin config, returns the env/block result. Separated from
 * the Fastify/worker glue so it can be unit-tested without a plugin SDK.
 */

import { resolveAdapterProviderMapping } from "./provider-map.js";
import {
  resolveEffectiveMode,
  readAgentOverride,
  type DefaultMode,
} from "./mode-resolver.js";
import { pingDpo } from "./dpo-ping.js";

export interface PluginConfig {
  dpoUrl: string;
  sharedKey?: string;
  defaultMode: DefaultMode;
  providers: readonly string[];
  healthCheckTimeoutMs: number;
  /**
   * When true, a run whose effective mode is `enabled` (i.e. resolved from
   * `default-on` without explicit opt-out) is **blocked** if the DPO is
   * unreachable, instead of falling open to a direct-to-provider call.
   *
   * Default: false — preserves the legacy `default-on` semantics where
   * unreachable DPO silently disables proxying for the run. Turn this on
   * when the `default-on` policy is actually a security control you rely
   * on, to close the "DPO down → PII egress in plaintext" gap.
   *
   * `required` mode is always fail-closed regardless of this flag.
   * `default-off` is unaffected (no proxy injected either way).
   */
  failClosedOnUnreachable?: boolean;
}

export interface HookInput {
  agentId: string;
  companyId: string;
  runId: string;
  adapterType: string;
  runtimeConfig: Record<string, unknown>;
  adapterEnv: Record<string, string>;
  context: Record<string, unknown>;
}

export interface HookOutput {
  env?: Record<string, string>;
  runtimeConfig?: Record<string, unknown>;
  block?: { reason: string; message: string };
}

export interface HookDeps {
  fetchFn?: typeof fetch;
  /** Called on any skipped/blocked decision for operator visibility. */
  log?: (level: "info" | "warn" | "error", message: string, fields?: Record<string, unknown>) => void;
}

export async function handleBeforeAdapterExecute(
  input: HookInput,
  config: PluginConfig,
  deps: HookDeps = {},
): Promise<HookOutput> {
  const log =
    deps.log ??
    ((lvl, msg, fields) => {
      // default no-op; workers inject a real logger
      void lvl;
      void msg;
      void fields;
    });

  const providerMapping = resolveAdapterProviderMapping(input.adapterType, config.providers);
  if (!providerMapping) {
    // Local or unsupported adapter — not our concern.
    return {};
  }

  const override = readAgentOverride(input.adapterEnv);
  const effective = resolveEffectiveMode({
    defaultMode: config.defaultMode,
    agentOverride: override,
  });

  if (effective === "disabled") {
    log("info", "pii-proxy skipped (agent disabled or company default-off)", {
      agentId: input.agentId,
      adapterType: input.adapterType,
      override,
    });
    return {};
  }

  const reachability = await pingDpo({
    dpoUrl: config.dpoUrl,
    sharedKey: config.sharedKey,
    timeoutMs: config.healthCheckTimeoutMs,
    fetchFn: deps.fetchFn,
  });

  if (!reachability.reachable) {
    const shouldBlock =
      effective === "required" ||
      (effective === "enabled" && config.failClosedOnUnreachable === true);
    if (shouldBlock) {
      const policyLabel = effective === "required" ? "required-mode" : "fail-closed";
      log("error", `pii-proxy unreachable under ${policyLabel} policy — blocking run`, {
        agentId: input.agentId,
        runId: input.runId,
        reason: reachability.reason,
        mode: effective,
      });
      return {
        block: {
          reason: "pii_proxy_unreachable",
          message: `pii-proxy at ${config.dpoUrl} unreachable (${reachability.reason}) — run blocked per ${policyLabel} policy`,
        },
      };
    }
    log("warn", "pii-proxy unreachable — proceeding WITHOUT protection (policy allows fall-open)", {
      agentId: input.agentId,
      runId: input.runId,
      reason: reachability.reason,
      mode: effective,
    });
    return {};
  }

  const injectedUrl = buildPassthroughUrl(config.dpoUrl, providerMapping.path);
  log("info", "pii-proxy active — injecting provider base URL", {
    agentId: input.agentId,
    adapterType: input.adapterType,
    envVar: providerMapping.envVar,
    injectedUrl,
    mode: effective,
  });

  return {
    env: {
      [providerMapping.envVar]: injectedUrl,
    },
  };
}

function buildPassthroughUrl(base: string, path: string): string {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  const ensuredPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmed}${ensuredPath}`;
}

export const _buildPassthroughUrl = buildPassthroughUrl;
