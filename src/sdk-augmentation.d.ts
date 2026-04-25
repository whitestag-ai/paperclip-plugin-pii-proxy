/**
 * Locally-vendored type extensions for the `onBeforeAdapterExecute` plugin
 * hook. The hook is implemented in the Paperclip host (M0 work in
 * `feat/lmstudio-dynamic-models`) and consumed by this plugin, but the
 * upstream `@paperclipai/plugin-sdk` package on npm has not yet been
 * republished with the new types.
 *
 * Once the host changes land in `paperclipai/paperclip` and a new SDK
 * version is published, this file can be deleted and the imports in
 * `worker.ts` will resolve directly against the published SDK.
 */

declare module "@paperclipai/plugin-sdk" {
  export interface BeforeAdapterExecuteParams {
    agentId: string;
    companyId: string;
    runId: string;
    adapterType: string;
    runtimeConfig: Record<string, unknown>;
    adapterEnv: Record<string, string>;
    context: Record<string, unknown>;
  }

  export interface BeforeAdapterExecuteBlock {
    reason: string;
    message: string;
  }

  export interface BeforeAdapterExecuteResult {
    env?: Record<string, string>;
    runtimeConfig?: Record<string, unknown>;
    block?: BeforeAdapterExecuteBlock;
  }

  interface PluginDefinition {
    onBeforeAdapterExecute?(
      params: BeforeAdapterExecuteParams,
    ): Promise<BeforeAdapterExecuteResult | void> | BeforeAdapterExecuteResult | void;
  }
}

export {};
