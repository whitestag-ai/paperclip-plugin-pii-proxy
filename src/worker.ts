import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type {
  PluginContext,
  BeforeAdapterExecuteParams,
  BeforeAdapterExecuteResult,
  PluginHealthDiagnostics,
} from "@paperclipai/plugin-sdk";
import { handleBeforeAdapterExecute, type PluginConfig } from "./hook-logic.js";
import { pingDpo } from "./dpo-ping.js";
import type { DefaultMode } from "./mode-resolver.js";

const PLUGIN_NAME = "pii-proxy";

interface InstanceConfig {
  dpoUrl: string;
  sharedKey?: string;
  defaultMode?: DefaultMode;
  providers?: string[];
  healthCheckTimeoutMs?: number;
  failClosedOnUnreachable?: boolean;
}

function normalizeConfig(raw: unknown): PluginConfig {
  const cfg = (raw ?? {}) as InstanceConfig;
  return {
    dpoUrl: cfg.dpoUrl ?? "http://localhost:4711",
    sharedKey: cfg.sharedKey,
    defaultMode: (cfg.defaultMode ?? "default-off") as DefaultMode,
    providers: Array.isArray(cfg.providers) && cfg.providers.length > 0
      ? cfg.providers
      : ["anthropic", "openai"],
    healthCheckTimeoutMs:
      typeof cfg.healthCheckTimeoutMs === "number" && cfg.healthCheckTimeoutMs > 0
        ? cfg.healthCheckTimeoutMs
        : 2000,
    failClosedOnUnreachable: cfg.failClosedOnUnreachable === true,
  };
}

let ctx: PluginContext | null = null;
let currentConfig: PluginConfig = normalizeConfig({});

const plugin = definePlugin({
  async setup(hostContext: PluginContext) {
    ctx = hostContext;
    const raw = await ctx.config.get();
    currentConfig = normalizeConfig(raw);
    ctx.logger.info(`${PLUGIN_NAME} plugin started`, {
      dpoUrl: currentConfig.dpoUrl,
      defaultMode: currentConfig.defaultMode,
      providers: currentConfig.providers,
    });
  },

  async onConfigChanged(newConfig: Record<string, unknown>) {
    currentConfig = normalizeConfig(newConfig);
    if (ctx) {
      ctx.logger.info(`${PLUGIN_NAME} config reloaded`, {
        dpoUrl: currentConfig.dpoUrl,
        defaultMode: currentConfig.defaultMode,
        providers: currentConfig.providers,
      });
    }
  },

  async onHealth(): Promise<PluginHealthDiagnostics> {
    const result = await pingDpo({
      dpoUrl: currentConfig.dpoUrl,
      sharedKey: currentConfig.sharedKey,
      timeoutMs: currentConfig.healthCheckTimeoutMs,
    });
    if (result.reachable) {
      return { status: "ok", message: `pii-proxy reachable at ${currentConfig.dpoUrl}` };
    }
    return {
      status: "degraded",
      message: `pii-proxy unreachable at ${currentConfig.dpoUrl} (${result.reason}). Cloud-LLM agent runs under 'required' mode will be blocked.`,
    };
  },

  async onBeforeAdapterExecute(
    input: BeforeAdapterExecuteParams,
  ): Promise<BeforeAdapterExecuteResult | void> {
    const result = await handleBeforeAdapterExecute(input, currentConfig, {
      log: (level, message, fields) => {
        if (!ctx) return;
        const fn =
          level === "error"
            ? ctx.logger.error
            : level === "warn"
              ? ctx.logger.warn
              : ctx.logger.info;
        fn.call(ctx.logger, message, fields);
      },
    });
    if (result.block) return { block: result.block };
    if (result.env || result.runtimeConfig) return result;
    return; // no changes
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
