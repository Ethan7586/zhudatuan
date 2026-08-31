import type { ProviderHealth, ProviderManifest, UnsignedProviderManifest } from '@shop/contract';
import { token } from '../../../../bootstrap/Container';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { HealthRecord } from '../../domain/model/HealthRecord';
import type { Installation, InstallationState } from '../../domain/model/Installation';

export interface ExtensionCandidate {
  readonly token: string;
  readonly installation: string;
  readonly provider: string;
  readonly scope: string;
  readonly version: number;
  readonly manifest: ProviderManifest;
  readonly health: ProviderHealth;
  readonly latency: number;
  readonly probes: Readonly<{ contract: 'passed'; sandbox: ProviderHealth; canary: ProviderHealth }>;
}

export interface ExtensionLoader {
  definition(provider: string): UnsignedProviderManifest;
  stage(installation: string, context: ExtensionLoadContext): Promise<ExtensionCandidate>;
  activate(candidate: ExtensionCandidate): Promise<void>;
  discard(candidate: ExtensionCandidate): Promise<void>;
  active(candidate: ExtensionCandidate): boolean;
  disable(provider: string, scope: string): Promise<void>;
  reconcile(): Promise<void>;
}

export interface ExtensionLoadContext {
  readonly tenant: string;
  readonly membership: string;
  readonly scope: string;
  readonly actor: string;
  readonly trace: string;
  readonly workload: 'query' | 'worker';
}

export const EXTENSION_LOADER = token<ExtensionLoader>('extension.loader');

export interface RegisteredManifest {
  readonly id: string;
  readonly version: string;
  readonly manifest: unknown;
  readonly manifest_hash: string;
  readonly signature: string;
  readonly contract_version: string;
  readonly contract_status: string;
  readonly schema_hash: string;
}
export interface InstallInput {
  readonly id: string;
  readonly scope: string;
  readonly baseUrl: string | null;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly secretRef: string | null;
  readonly healthOperation: string;
  readonly actor: string;
  readonly trace: string;
  readonly manifest: ProviderManifest;
  readonly manifestHash: string;
}
export interface ExtensionListRow extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly installed_at: string;
}
export interface ExtensionSummary extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly capabilities: unknown;
  readonly health_state: unknown;
  readonly health_latency_ms: unknown;
  readonly health_reason: unknown;
  readonly checked_at: unknown;
}
export interface ExtensionStateSink {
  degrade(database: OperationDatabase, id: string, scope: string): Promise<void>;
}

export interface ExtensionRepository {
  manifest(provider: string): Promise<RegisteredManifest | null>;
  install(input: InstallInput): Promise<Installation>;
  reconfigure(id: string, scope: string, input: Readonly<{ baseUrl: string | null; endpoints: Readonly<Record<string, string>>; secretRef: string | null; healthOperation: string; actor: string; trace: string }>): Promise<Installation>;
  lock(id: string, scope: string): Promise<Installation | null>;
  activation(id: string, scope: string, provider: string): Promise<Readonly<{ candidate: Installation; active: Installation | null }>>;
  latestHealth(id: string, version: number): Promise<Readonly<{ state: 'healthy' | 'degraded' | 'unavailable'; checkedAt: string; latency: number }> | null>;
  transition(installation: Installation, next: InstallationState, actor: string, evidence: unknown): Promise<Installation>;
  health(record: HealthRecord): Promise<void>;
  enqueueHealth(id: string, scope: string, delaySeconds?: number): Promise<void>;
  enqueueScan(delaySeconds?: number): Promise<void>;
  list(scopes: readonly string[], cursor: Readonly<{ sort: string | null; id: string | null }>, fetch: number): Promise<readonly ExtensionListRow[]>;
  targets(limit: number): Promise<readonly Readonly<{ id: string; scope_id: string; extension_id: string; status: InstallationState }>[]>;
  summaries(ids: readonly string[]): Promise<readonly ExtensionSummary[]>;
}
export type ExtensionRepositoryFactory = (database: OperationDatabase) => ExtensionRepository;
