import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

const OptionalText = z.string().nullable().optional();
const SignedDatabaseIntegerSchema = z
  .union([z.number().int(), z.string().regex(/^-?(?:0|[1-9][0-9]*)$/)])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .refine(Number.isSafeInteger, 'DATABASE_INTEGER_OUT_OF_RANGE');

const EntrySchema = z
  .object({
    id: z.string().min(1),
    side: z.enum(['debit', 'credit']),
    amount_minor: DatabaseIntegerSchema,
    code: z.string().min(1),
    currency: z.string().length(3),
    reference_type: z.string().min(1),
    reference_id: z.string().min(1),
    description: z.string(),
    posted_at: OptionalText,
  })
  .passthrough();

const StatementSchema = z
  .object({
    id: z.string().min(1),
    period_start: z.string().min(1),
    period_end: z.string().min(1),
    currency: z.string().length(3),
    opening_minor: SignedDatabaseIntegerSchema,
    debit_minor: DatabaseIntegerSchema,
    credit_minor: DatabaseIntegerSchema,
    closing_minor: SignedDatabaseIntegerSchema,
    state: z.string().min(1),
    generated_at: z.string().min(1),
  })
  .passthrough();

const ReconciliationSchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    partner_id: z.string().min(1),
    period: z.string().min(1),
    state: z.string().min(1),
    difference_minor: SignedDatabaseIntegerSchema,
    updated_at: z.string().min(1),
  })
  .passthrough();

const SettlementSchema = z
  .object({
    id: z.string().min(1),
    partner_id: z.string().min(1),
    period: z.string().min(1),
    reconciliation_id: z.string().min(1),
    amount_minor: DatabaseIntegerSchema,
    currency: z.string().length(3),
    state: z.string().min(1),
    version: DatabaseIntegerSchema,
  })
  .passthrough();

const WithdrawalSchema = z
  .object({
    id: z.string().min(1),
    settlement_id: z.string().min(1),
    amount_minor: DatabaseIntegerSchema,
    currency: z.string().length(3),
    state: z.string().min(1),
    created_at: z.string().min(1),
    version: DatabaseIntegerSchema,
  })
  .passthrough();

const InvoiceSchema = z
  .object({
    id: z.string().min(1),
    profile_id: z.string().min(1),
    amount_minor: DatabaseIntegerSchema,
    currency: z.string().length(3),
    state: z.string().min(1),
    created_at: z.string().min(1),
    version: DatabaseIntegerSchema,
    settlement_id: OptionalText,
    issued_at: OptionalText,
  })
  .passthrough();

export const EntryPageSchema = pageEnvelope(EntrySchema);
export const StatementPageSchema = pageEnvelope(StatementSchema);
export const ReconciliationPageSchema = pageEnvelope(ReconciliationSchema);
export const SettlementPageSchema = pageEnvelope(SettlementSchema);
export const WithdrawalPageSchema = pageEnvelope(WithdrawalSchema);
export const InvoicePageSchema = pageEnvelope(InvoiceSchema);

export type FinanceSection = 'entries' | 'statements' | 'reconciliations' | 'settlements' | 'withdrawals' | 'invoices';

export interface FinanceRecord {
  readonly id: string;
  readonly label: string;
  readonly reference: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly state: string;
  readonly occurredAt: string | null;
  readonly version: number | null;
}

export interface FinanceRecordPage {
  readonly items: readonly FinanceRecord[];
  readonly count: number;
  readonly nextCursor?: string;
}
