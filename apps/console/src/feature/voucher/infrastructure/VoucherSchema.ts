import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../../shared/schema/PageEnvelope';

const NullableInteger = z.nullable(DatabaseIntegerSchema);

export const CardLibrarySchema = z.object({ id: z.string().min(1), code_prefix: z.string().min(1), mode: z.string().min(1), status: z.string().min(1), version: DatabaseIntegerSchema, import_state: z.string().nullable().optional(), total_count: NullableInteger.optional(), success_count: NullableInteger.optional(), failure_count: NullableInteger.optional() }).passthrough();
export const VoucherProgramSchema = z.object({ id: z.string().min(1), name: z.string().min(1), value_minor: DatabaseIntegerSchema, currency: z.string().length(3), default_valid_days: DatabaseIntegerSchema, status: z.string().min(1), approval_required: z.boolean(), version: DatabaseIntegerSchema }).passthrough();
export const ReserveSchema = z.object({ id: z.string().min(1), request_number: z.string().min(1), program_id: z.string().min(1), program_version: DatabaseIntegerSchema, name: z.string().min(1), requested_count: DatabaseIntegerSchema, requested_minor: DatabaseIntegerSchema, state: z.string().min(1), requested_by: z.string().min(1), created_at: z.string().min(1) }).passthrough();
export const IssueBatchSchema = z.object({ id: z.string().min(1), program_id: z.string().min(1), program_version: DatabaseIntegerSchema, cardpool_id: z.string().nullable(), reserve_request_id: z.string().nullable(), name: z.string().min(1), state: z.string().min(1), requested_count: DatabaseIntegerSchema, issued_count: DatabaseIntegerSchema, created_at: z.string().min(1) }).passthrough();
export const StatusBatchSchema = z.object({ id: z.string().min(1), action: z.string().min(1), reason: z.string(), actor_id: z.string(), state: z.string().min(1), requested_count: DatabaseIntegerSchema, succeeded_count: DatabaseIntegerSchema, failed_count: DatabaseIntegerSchema, created_at: z.string().min(1), updated_at: z.string().min(1) }).passthrough();
export const BindingSchema = z.object({ id: z.string().min(1), program_id: z.string().min(1), name: z.string().min(1), member_id: z.string().nullable(), initial_minor: DatabaseIntegerSchema, remaining_minor: DatabaseIntegerSchema, state: z.string().min(1), expires_at: z.string().min(1), version: DatabaseIntegerSchema }).passthrough();
export const RedemptionSchema = z.object({ id: z.string().min(1), voucher_id: z.string().min(1), order_id: z.string().nullable(), amount_minor: DatabaseIntegerSchema, redeemed_at: z.string().min(1), version: DatabaseIntegerSchema, program_id: z.string().min(1), reversed_minor: DatabaseIntegerSchema, receipt_state: z.string().min(1) }).passthrough();
export const HistorySchema = z.object({ voucher_id: z.string().min(1), sequence: DatabaseIntegerSchema, previous_state: z.string().nullable(), next_state: z.string().min(1), reason: z.string(), actor_id: z.string(), occurred_at: z.string().min(1), cursor_id: z.string().min(1) }).passthrough();

export const CardLibraryPageSchema = pageEnvelope(CardLibrarySchema);
export const VoucherProgramPageSchema = pageEnvelope(VoucherProgramSchema);
export const ReservePageSchema = pageEnvelope(ReserveSchema);
export const IssueBatchPageSchema = pageEnvelope(IssueBatchSchema);
export const StatusBatchPageSchema = pageEnvelope(StatusBatchSchema);
export const BindingPageSchema = pageEnvelope(BindingSchema);
export const RedemptionPageSchema = pageEnvelope(RedemptionSchema);
export const HistoryPageSchema = pageEnvelope(HistorySchema);
