export interface TelemetryContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly actorId?: string;
  readonly membershipId?: string;
  readonly tenantId?: string;
  readonly scopeKind?: string;
  readonly scopeId?: string;
  readonly module?: string;
  readonly operation?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly result?: string;
  readonly errorCode?: string;
  readonly durationMs?: number;
  readonly dependency?: string;
  readonly dependencyDurationMs?: number;
  readonly version?: string;
  readonly provider?: string;
  readonly target?: string;
  readonly job?: string;
  readonly queue?: string;
  readonly attempt?: number;
}
