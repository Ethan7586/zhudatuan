export interface DependencyHealth {
  readonly name: string;
  readonly state: 'healthy' | 'unhealthy';
  readonly durationMs: number;
  readonly observedAt: string;
  readonly traceId: string | null;
}

export interface QueueHealth {
  readonly name: string;
  readonly state: 'idle' | 'active' | 'backlogged';
  readonly depth: number;
  readonly observedAt: string;
}

export interface ProviderHealth {
  readonly name: string;
  readonly state: 'healthy' | 'degraded';
  readonly operation: string | null;
  readonly observedAt: string;
  readonly traceId: string | null;
}

export interface ServiceLevelResult {
  readonly id: string;
  readonly title: string;
  readonly indicator: string;
  readonly owner: string;
  readonly target: number;
  readonly current: number | null;
  readonly unit: 'percent' | 'milliseconds' | 'seconds';
  readonly windowSeconds: number;
  readonly severity: 'warning' | 'critical';
  readonly runbook: string;
  readonly status: 'healthy' | 'atrisk' | 'breaching' | 'nodata';
  readonly burnRate: number | null;
  readonly errorBudgetRemainingPercent: number | null;
  readonly total: number;
}

export interface ServiceLevelReport {
  readonly generatedAt: string;
  readonly windowSeconds: number;
  readonly items: readonly ServiceLevelResult[];
  readonly count: number;
}

export interface HealthOverview {
  readonly generatedAt: string;
  readonly condition: 'healthy' | 'degraded';
  readonly degraded: readonly string[];
  readonly dependencies: readonly DependencyHealth[];
  readonly queues: readonly QueueHealth[];
  readonly providers: readonly ProviderHealth[];
  readonly serviceLevels: Readonly<{ healthy: number; atRisk: number; breaching: number; noData: number }>;
  readonly release: Readonly<{ version: string; contract: string; configuration: string; schema: string; startedAt: string }>;
}

export interface OperationalReader {
  overview(): Promise<HealthOverview>;
  serviceLevels(): Promise<ServiceLevelReport>;
}
