import type { OperationOutputFor } from '@shop/contract';

type PlatformDto = OperationOutputFor<'organization.layers.read'>['items'][number];
type DistributorDto = OperationOutputFor<'channel.distributors.read'>['items'][number];
type RuntimeDto = OperationOutputFor<'runtime.health.dependency'>;
type ObservabilityDto = OperationOutputFor<'observability.healthoverview.read'>;

export type ControlKind = 'platform' | 'distribution' | 'runtime';
export const CONTROL_PAGE_LIMIT = 50;

export interface PlatformLayer {
  readonly id: string;
  readonly kind: string;
  readonly parentId: string | null;
  readonly parentName: string | null;
  readonly name: string;
  readonly timezone: string;
  readonly status: PlatformDto['status'];
  readonly version: number;
}

export interface Distributor {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly settlementMode: string;
  readonly status: DistributorDto['status'];
  readonly tenantCount: number;
  readonly updatedAt: string;
}

export interface ControlPage<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly nextCursor?: string;
}
export interface RuntimeChecksum {
  readonly checksum: string;
  readonly matches: boolean;
}
export interface RuntimeQueryMetric {
  readonly workload: RuntimeDto['databaseQueries'][number]['workload'];
  readonly count: number;
  readonly failures: number;
  readonly totalMilliseconds: number;
  readonly maximumMilliseconds: number;
}
export interface RuntimeHealth {
  readonly status: RuntimeDto['status'];
  readonly queue: Readonly<{ queued: number; running: number; deadletters: number; oldestSeconds: number }>;
  readonly cache: Readonly<{ available: boolean; reason?: string }>;
  readonly databaseQueries: readonly RuntimeQueryMetric[];
  readonly readiness: Readonly<{
    healthy: boolean;
    condition: RuntimeDto['readiness']['condition'];
    degraded: readonly string[];
    configuration: RuntimeChecksum;
    contract: RuntimeChecksum;
    migration: Readonly<{ head: string; matches: boolean }>;
    registries: Readonly<{ operations: number; events: number; jobs: number; checksum: string }>;
    database: Readonly<{ writable: boolean; migration: boolean; contract: boolean; role: boolean; operations: number; capabilities: number; events: number; invitationKeys: boolean }>;
    extensions: Readonly<{ registered: number; healthy: number; unhealthy: number; checksum: string }>;
  }>;
}

export interface CapabilityHealth {
  readonly count: number;
  readonly enabled: number;
  readonly disabled: number;
  readonly dependencyIssues: number;
}

export interface ExtensionHealth {
  readonly count: number;
  readonly enabled: number;
  readonly healthy: number;
  readonly degraded: number;
  readonly unavailable: number;
}

export interface RiskHealth {
  readonly count: number;
  readonly policies: number;
  readonly activePolicies: number;
  readonly cases: number;
  readonly openCases: number;
}

export interface ObservabilityHealth {
  readonly generatedAt: string;
  readonly condition: ObservabilityDto['condition'];
  readonly degraded: number;
  readonly unhealthyDependencies: number;
  readonly backloggedQueues: number;
  readonly degradedProviders: number;
  readonly release: string;
}

export interface ServiceLevelHealth {
  readonly count: number;
  readonly healthy: number;
  readonly atRisk: number;
  readonly breaching: number;
  readonly noData: number;
}

export interface RuntimeControl {
  readonly runtime: RuntimeHealth;
  readonly capabilities: CapabilityHealth;
  readonly extensions: ExtensionHealth;
  readonly risk: RiskHealth;
  readonly observability: ObservabilityHealth;
  readonly serviceLevels: ServiceLevelHealth;
}

export type ControlData = Readonly<{ kind: 'platform'; page: ControlPage<PlatformLayer> }> | Readonly<{ kind: 'distribution'; page: ControlPage<Distributor> }> | Readonly<{ kind: 'runtime'; health: RuntimeControl }>;

export function controlKind(scope: string): ControlKind {
  return scope === 'platform' ? 'platform' : scope === 'distributor' ? 'distribution' : 'runtime';
}
