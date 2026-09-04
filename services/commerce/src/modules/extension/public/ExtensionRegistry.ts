import type { ProviderCapability, ProviderPortForCapability } from '@shop/contract';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { ProviderManifest } from '@shop/contract';

export interface ExtensionInstallRequest {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly baseUrl: string | null;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly secretRef: string | null;
  readonly healthOperation: string;
  readonly actor: string;
  readonly trace: string;
}

export interface ExtensionConfiguration {
  readonly baseUrl: string | null;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly secretRef: string | null | undefined;
  readonly healthOperation: string;
  readonly actor: string;
  readonly trace: string;
}

export interface InstallExtensionPort {
  execute(context: WriteTransactionContext, input: ExtensionInstallRequest): Promise<Readonly<{ manifest: ProviderManifest }>>;
  reconfigure(context: WriteTransactionContext, id: string, scope: string, input: ExtensionConfiguration): Promise<void>;
}

export interface EnableExtensionPort {
  test(context: WriteTransactionContext, id: string, scope: string, actor: string, trace: string): Promise<void>;
  enable(context: WriteTransactionContext, id: string, scope: string, actor: string, trace: string): Promise<string | null>;
}

export interface DisableExtensionPort {
  execute(context: WriteTransactionContext, id: string, scope: string, actor: string, trace: string): Promise<string>;
}

export interface ExtensionSummary extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly capabilities: unknown;
  readonly health_state: unknown;
  readonly health_latency_ms: unknown;
  readonly health_reason: unknown;
  readonly checked_at: unknown;
}

export interface ExtensionRegistryPort {
  strategy<C extends ProviderCapability>(provider: string, scope: string, capability: C | readonly C[]): ProviderPortForCapability<C>;
  install(): InstallExtensionPort;
  enable(): EnableExtensionPort;
  disable(): DisableExtensionPort;
  summaries(context: ReadTransactionContext, installations: readonly string[]): Promise<readonly ExtensionSummary[]>;
}

export const EXTENSION_REGISTRY_PORT = publicPort<ExtensionRegistryPort>('extension', 'registry');
