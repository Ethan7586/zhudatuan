import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../../shared/schema/DatabaseInteger';

const OptionalText = z.string().min(1).nullable().optional();
const SignedDatabaseIntegerSchema = z
  .union([z.number().int(), z.string().regex(/^-?(?:0|[1-9][0-9]*)$/)])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .refine(Number.isSafeInteger, 'DATABASE_INTEGER_OUT_OF_RANGE');

export const FinanceReconciliationItemSchema = z
  .object({
    id: z.string().min(1),
    externalMinor: SignedDatabaseIntegerSchema,
    internalMinor: SignedDatabaseIntegerSchema,
    differenceMinor: SignedDatabaseIntegerSchema,
    state: z.string().min(1),
    reasonCode: OptionalText,
    evidence: z.record(z.string(), z.unknown()).optional().default({}),
    resolution: z.record(z.string(), z.unknown()).nullable().optional(),
    resolvedBy: OptionalText,
    approvedBy: OptionalText,
  })
  .passthrough();

export const FinanceReconciliationSchema = z
  .object({
    id: z.string().min(1),
    scope_id: OptionalText,
    provider: z.string().min(1),
    partner_id: z.string().min(1),
    period: z.string().min(1),
    statement_ref: OptionalText,
    statement_hash: OptionalText,
    debit_minor: SignedDatabaseIntegerSchema,
    credit_minor: SignedDatabaseIntegerSchema,
    difference_minor: SignedDatabaseIntegerSchema,
    state: z.string().min(1),
    evidence: z.record(z.string(), z.unknown()).optional().default({}),
    approved_by: OptionalText,
    updated_at: z.string().min(1),
    version: DatabaseIntegerSchema,
    item_counts: z.record(z.string(), DatabaseIntegerSchema).optional().default({}),
    items: z.array(FinanceReconciliationItemSchema).optional().default([]),
  })
  .passthrough();

export const FinanceReconciliationPageSchema = z
  .object({
    items: z.array(FinanceReconciliationSchema).max(100),
    count: z.number().int().nonnegative(),
    nextCursor: z.string().min(1).optional(),
  })
  .superRefine((page, context) => {
    if (page.count !== page.items.length) context.addIssue({ code: 'custom', message: 'FINANCE_PAGE_COUNT_MISMATCH' });
  });
