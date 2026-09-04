import type { ExtensionLoadContext } from './ExtensionLoader';

export interface RuntimeInstallation {
  readonly id: string;
  readonly extension_id: string;
  readonly scope_id: string;
  readonly manifest: unknown;
  readonly base_url: string | null;
  readonly endpoints: unknown;
  readonly secret_ref: string | null;
  readonly health_operation: string | null;
  readonly version: number;
}

/** Persistence boundary used by the provider runtime bootstrap. */
export interface ExtensionRuntimeStore {
  enabled(signal: AbortSignal, deadline?: number): Promise<readonly RuntimeInstallation[]>;
  find(installation: string, context: ExtensionLoadContext): Promise<RuntimeInstallation | null>;
}
