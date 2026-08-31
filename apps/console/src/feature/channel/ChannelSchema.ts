import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const ChannelConnectionSchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    status: z.string().min(1),
    contract_version: z.string().min(1),
    region: z.string().min(1),
    max_concurrency: DatabaseIntegerSchema,
    max_attempts: DatabaseIntegerSchema,
    failure_threshold: DatabaseIntegerSchema,
    recovery_ms: DatabaseIntegerSchema,
    version: DatabaseIntegerSchema,
    updated_at: z.string().min(1),
    has_secret: z.boolean(),
  })
  .passthrough();
export const ChannelSyncSchema = z
  .object({
    id: z.string().min(1),
    connection_id: z.string().min(1),
    kind: z.string().min(1),
    state: z.string().min(1),
    pulled_count: DatabaseIntegerSchema,
    accepted_count: DatabaseIntegerSchema,
    rejected_count: DatabaseIntegerSchema,
    watermark: z.string().nullable(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
  })
  .passthrough();
export const ChannelOperationSchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    kind: z.string().min(1),
    internal_reference: z.string().min(1),
    external_reference: z.string().nullable(),
    state: z.string().min(1),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
  })
  .passthrough();
export const ChannelConnectionPageSchema = pageEnvelope(ChannelConnectionSchema);
export const ChannelSyncPageSchema = pageEnvelope(ChannelSyncSchema);
export const ChannelOperationPageSchema = pageEnvelope(ChannelOperationSchema);
export type ChannelView = 'connections' | 'syncs' | 'operations';
export interface ChannelRecord {
  readonly id: string;
  readonly provider: string;
  readonly kind: string;
  readonly state: string;
  readonly progress: string;
  readonly reference: string;
  readonly occurredAt: string | null;
  readonly version: number | null;
}
export interface ChannelRecordPage {
  readonly items: readonly ChannelRecord[];
  readonly count: number;
  readonly nextCursor?: string;
}
