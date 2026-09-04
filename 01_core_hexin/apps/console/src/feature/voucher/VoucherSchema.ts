import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const CardLibrarySchema = z.object({
  id: z.string().min(1), code_prefix: z.string().min(1), mode: z.string().min(1), status: z.string().min(1),
  version: DatabaseIntegerSchema, import_state: z.string().nullable().optional(), total_count: z.nullable(DatabaseIntegerSchema).optional(),
  success_count: z.nullable(DatabaseIntegerSchema).optional(), failure_count: z.nullable(DatabaseIntegerSchema).optional(),
}).passthrough();
export const VoucherProgramSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), value_minor: DatabaseIntegerSchema, currency: z.string().length(3),
  status: z.string().min(1), approval_required: z.boolean(), version: DatabaseIntegerSchema,
}).passthrough();
export const ReserveSchema = z.object({
  id: z.string().min(1), request_number: z.string().min(1), name: z.string().min(1), requested_count: DatabaseIntegerSchema,
  requested_minor: DatabaseIntegerSchema, state: z.string().min(1), created_at: z.string().min(1),
}).passthrough();
export const IssueBatchSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), state: z.string().min(1), requested_count: DatabaseIntegerSchema,
  issued_count: DatabaseIntegerSchema, created_at: z.string().min(1),
}).passthrough();

export const CardLibraryPageSchema = pageEnvelope(CardLibrarySchema);
export const VoucherProgramPageSchema = pageEnvelope(VoucherProgramSchema);
export const ReservePageSchema = pageEnvelope(ReserveSchema);
export const IssueBatchPageSchema = pageEnvelope(IssueBatchSchema);
export type VoucherView = 'libraries' | 'programs' | 'reserves' | 'batches';
export interface VoucherRecord {
  readonly id: string; readonly name: string; readonly state: string; readonly detail: string;
  readonly quantity: number | null; readonly amountMinor: number | null; readonly currency: string | null;
  readonly occurredAt: string | null; readonly version: number | null;
}
export interface VoucherRecordPage { readonly items: readonly VoucherRecord[]; readonly count: number; readonly nextCursor?: string }
