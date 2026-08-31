import { z } from 'zod';

export const LayerPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.string().min(1),
      parent_id: z.string().nullable().optional(),
      name: z.string().min(1),
      timezone: z.string().min(1).optional(),
      status: z.string().min(1),
      version: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
    })
  ),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).optional(),
});

export const DistributorPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      organization_id: z.string().min(1),
      code: z.string().min(1),
      name: z.string().min(1),
      settlement_mode: z.string().min(1),
      status: z.string().min(1),
      tenant_count: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
      updated_at: z.string().min(1),
    })
  ),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).optional(),
});

const ChecksumSchema = z.object({ checksum: z.string(), matches: z.boolean() });
export const RuntimeControlSchema = z.object({
  status: z.enum(['available', 'degraded']),
  queue: z.object({ queued: z.number().nonnegative(), running: z.number().nonnegative(), deadletters: z.number().nonnegative(), oldest_seconds: z.number().nonnegative() }),
  cache: z.object({ available: z.boolean(), reason: z.string().optional() }),
  databaseQueries: z.array(
    z.object({ workload: z.enum(['query', 'command', 'worker', 'migration']), count: z.number().nonnegative(), failures: z.number().nonnegative(), totalMilliseconds: z.number().nonnegative(), maximumMilliseconds: z.number().nonnegative() })
  ),
  readiness: z.object({
    healthy: z.boolean(),
    condition: z.enum(['ready', 'degraded', 'notready']),
    degraded: z.array(z.string()),
    configuration: ChecksumSchema,
    contract: ChecksumSchema,
    migration: z.object({ head: z.string(), matches: z.boolean() }),
    registries: z.object({ operations: z.number().nonnegative(), events: z.number().nonnegative(), jobs: z.number().nonnegative(), checksum: z.string() }),
    database: z.object({
      writable: z.boolean(),
      migration: z.boolean(),
      contract: z.boolean(),
      role: z.boolean(),
      operations: z.number().nonnegative(),
      capabilities: z.number().nonnegative(),
      events: z.number().nonnegative(),
      invitationKeys: z.boolean(),
    }),
    extensions: z.object({ registered: z.number().nonnegative(), healthy: z.number().nonnegative(), unhealthy: z.number().nonnegative(), checksum: z.string() }),
  }),
});

export type Layer = z.infer<typeof LayerPageSchema>['items'][number];
export type Distributor = z.infer<typeof DistributorPageSchema>['items'][number];
export type RuntimeControl = z.infer<typeof RuntimeControlSchema>;
