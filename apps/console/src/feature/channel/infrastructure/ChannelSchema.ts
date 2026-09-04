import { z } from 'zod';

const nonnegative = z.number().int().nonnegative();
const page = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), count: nonnegative, nextCursor: z.string().min(1).optional() }).strict();
const connection = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    scope_id: z.string().min(1),
    status: z.enum(['draft', 'testing', 'enabled', 'degraded', 'disabled']),
    contract_version: z.string().min(1),
    region: z.string().min(1),
    connection_timeout_ms: nonnegative,
    response_timeout_ms: nonnegative,
    total_deadline_ms: nonnegative,
    max_concurrency: nonnegative,
    requests_per_second: z.number().nonnegative(),
    max_attempts: nonnegative,
    failure_threshold: nonnegative,
    recovery_ms: nonnegative,
    version: nonnegative,
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    has_secret: z.boolean(),
    capabilities: z.array(z.string()).optional(),
    health_state: z.enum(['healthy', 'degraded', 'unhealthy']).nullable().optional(),
    health_latency_ms: nonnegative.nullable().optional(),
    health_reason: z.string().nullable().optional(),
    checked_at: z.string().nullable().optional(),
  })
  .strict();
const sync = z
  .object({
    id: z.string().min(1),
    connection_id: z.string().min(1),
    kind: z.enum(['catalog', 'price', 'stock', 'statement']),
    state: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
    cursor_value: z.string().nullable(),
    input_hash: z.string().min(1),
    input: z.record(z.string(), z.unknown()),
    error_summary: z.array(z.unknown()),
    watermark: z.string().nullable(),
    pulled_count: nonnegative,
    accepted_count: nonnegative,
    rejected_count: nonnegative,
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    version: nonnegative,
    cursor_sort: z.string().min(1),
  })
  .strict();
const operation = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    kind: z.string().min(1),
    internal_reference: z.string().min(1),
    external_reference: z.string().nullable(),
    state: z.enum(['queued', 'submitted', 'processing', 'succeeded', 'failed', 'unknown']),
    response: z.unknown().nullable(),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
  })
  .strict();

export const ChannelConnectionPageSchema = page(connection);
export const ChannelSyncPageSchema = page(sync);
export const ChannelOperationPageSchema = page(operation);
