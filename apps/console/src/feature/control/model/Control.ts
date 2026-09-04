export type ControlKind = 'platform' | 'distribution' | 'runtime';
export const CONTROL_PAGE_LIMIT = 50;

export interface PlatformLayer {
  readonly id: string;
  readonly kind: string;
  readonly parentId: string | null;
  readonly parentName: string | null;
  readonly name: string;
  readonly timezone: string;
  readonly status: 'draft' | 'active' | 'disabled';
  readonly version: number;
}

export interface Distributor {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly settlementMode: string;
  readonly status: 'draft' | 'active' | 'suspended' | 'terminated';
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
  readonly workload: 'query' | 'command' | 'worker' | 'migration';
  readonly count: number;
  readonly failures: number;
  readonly totalMilliseconds: number;
  readonly maximumMilliseconds: number;
}
export interface RuntimeHealth {
  readonly status: 'available' | 'degraded';
  readonly queue: Readonly<{ queued: number; running: number; deadletters: number; oldestSeconds: number }>;
  readonly cache: Readonly<{ available: boolean; reason?: string }>;
  readonly databaseQueries: readonly RuntimeQueryMetric[];
  readonly readiness: Readonly<{
    healthy: boolean;
    condition: 'ready' | 'degraded' | 'notready';
    degraded: readonly string[];
    configuration: RuntimeChecksum;
    contract: RuntimeChecksum;
    migration: Readonly<{ head: string; matches: boolean }>;
    registries: Readonly<{ operations: number; events: number; jobs: number; checksum: string }>;
    database: Readonly<{ writable: boolean; migration: boolean; contract: boolean; role: boolean; operations: number; capabilities: number; events: number; invitationKeys: boolean }>;
    extensions: Readonly<{ registered: number; healthy: number; unhealthy: number; checksum: string }>;
  }>;
}

export type ControlData = Readonly<{ kind: 'platform'; page: ControlPage<PlatformLayer> }> | Readonly<{ kind: 'distribution'; page: ControlPage<Distributor> }> | Readonly<{ kind: 'runtime'; health: RuntimeHealth }>;

export function controlKind(scope: string): ControlKind {
  return scope === 'platform' ? 'platform' : scope === 'distributor' ? 'distribution' : 'runtime';
}
