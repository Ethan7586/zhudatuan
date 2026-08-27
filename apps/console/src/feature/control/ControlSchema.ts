import { z } from 'zod';

const QueueSchema = z.object({
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  deadletters: z.number().int().nonnegative(),
  oldest_seconds: z.number().int().nonnegative(),
});

const QueryMetricSchema = z.object({
  workload: z.enum(['query', 'command', 'worker', 'migration']),
  count: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
  totalMilliseconds: z.number().finite().nonnegative(),
  maximumMilliseconds: z.number().finite().nonnegative(),
});

const CapabilityStatusSchema = z.enum(['stable', 'attention', 'action', 'changing', 'denied', 'unknown']);

const ControlPlaneSchema = z.object({
  evaluatedAt: z.string().min(1),
  coverageRatio: z.number().min(0).max(1),
  region: z.string().min(1).optional(),
  cell: z.string().min(1).optional(),
  assurance: z.string().min(1).optional(),
  conclusion: z.string().min(1),
  summary: z.string().min(1),
  incidents: z.array(z.object({
    id: z.string().min(1),
    priority: z.enum(['P1', 'P2', 'CHANGE']),
    title: z.string().min(1),
    impact: z.string().min(1),
    startedAt: z.string().min(1).optional(),
    retryCount: z.number().int().nonnegative().optional(),
    cause: z.string().min(1).optional(),
    owner: z.string().min(1).optional(),
    slaMinutes: z.number().int().nonnegative().optional(),
    action: z.string().min(1),
    affectedCapabilities: z.array(z.string().min(1)),
  })),
  capabilities: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    status: CapabilityStatusSchema,
    group: z.enum(['core', 'side']),
  })),
  changes: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    target: z.string().min(1),
    stopCondition: z.string().min(1),
    rollbackEstimate: z.string().min(1),
    status: z.enum(['planned', 'running', 'paused', 'verifying', 'rolledback']),
  })),
  audits: z.array(z.object({
    id: z.string().min(1),
    time: z.string().min(1),
    title: z.string().min(1),
    detail: z.string().min(1),
    status: z.enum(['verified', 'failed', 'pending']),
  })),
});

export const ControlSchema = z.object({
  status: z.enum(['available', 'degraded']),
  queue: QueueSchema,
  cache: z.object({ available: z.boolean(), reason: z.string().optional() }),
  databaseQueries: z.array(QueryMetricSchema),
  compatibility: z.object({
    healthy: z.boolean(),
    contract: z.object({ checksum: z.string().min(1), matches: z.boolean() }),
    schema: z.object({ version: z.string().min(1), matches: z.boolean() }),
    registries: z.object({
      operations: z.number().int().nonnegative(),
      events: z.number().int().nonnegative(),
      jobs: z.number().int().nonnegative(),
    }),
    database: z.object({
      writable: z.boolean(),
      schema: z.boolean(),
      contract: z.boolean(),
      operations: z.number().int().nonnegative(),
      capabilities: z.number().int().nonnegative(),
      events: z.number().int().nonnegative(),
    }),
  }),
  controlPlane: ControlPlaneSchema.optional(),
});

export type ControlData = z.infer<typeof ControlSchema>;
export type QueryMetric = ControlData['databaseQueries'][number];
export type ControlPlane = NonNullable<ControlData['controlPlane']>;
export type ControlIncident = ControlPlane['incidents'][number];
export type ControlCapability = ControlPlane['capabilities'][number];
export type ControlChange = ControlPlane['changes'][number];
export type ControlAudit = ControlPlane['audits'][number];
