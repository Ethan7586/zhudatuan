import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

const OptionalText = z.string().min(1).nullable().optional();
const SignedDatabaseIntegerSchema = z
  .union([z.number().int(), z.string().regex(/^-?(?:0|[1-9][0-9]*)$/)])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .refine(Number.isSafeInteger, 'DATABASE_INTEGER_OUT_OF_RANGE');

const FinancePreviewFacetSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  count: z.number().int().nonnegative(),
});

<<<<<<< HEAD
const FinanceFacetsSchema = z.object({
  periods: z.array(FinancePreviewFacetSchema),
  channels: z.array(FinancePreviewFacetSchema),
  malls: z.array(FinancePreviewFacetSchema),
  statuses: z.array(FinancePreviewFacetSchema),
  differenceTypes: z.array(FinancePreviewFacetSchema),
});

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
const FinanceRepairPreviewSchema = z.object({
  source: z.literal('local-preview'),
  status: z.enum(['service-preview', 'pending-review']),
  expiresAt: z.string().min(1),
  plan: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    operation: z.string().min(1),
    relatedPayment: z.string().min(1),
    accountingDate: z.string().min(1),
    scope: z.string().min(1),
  }),
  entries: z
    .array(
      z.object({
        side: z.enum(['debit', 'credit']),
        account: z.string().min(1),
        amountMinor: DatabaseIntegerSchema,
        currency: z.string().length(3),
      })
    )
    .min(2),
  result: z.object({
    ledgerBeforeMinor: SignedDatabaseIntegerSchema,
    ledgerAfterMinor: SignedDatabaseIntegerSchema,
    differenceBeforeMinor: SignedDatabaseIntegerSchema,
    differenceAfterMinor: SignedDatabaseIntegerSchema,
    settlementImpact: z.string().min(1),
  }),
  checks: z
    .array(
      z.object({
        label: z.string().min(1),
        state: z.enum(['passed', 'blocked']),
        detail: z.string().min(1),
      })
    )
    .min(1),
  reason: z.string().min(1),
  evidence: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).min(1),
  previewHash: z.string().min(1),
  idempotencyKey: z.string().min(1),
  sourceHash: z.string().min(1),
  itemVersion: DatabaseIntegerSchema,
  previewVersion: DatabaseIntegerSchema,
});

export const FinanceReconciliationItemSchema = z
  .object({
    id: z.string().min(1),
<<<<<<< HEAD
    version: DatabaseIntegerSchema,
    externalMinor: SignedDatabaseIntegerSchema,
    internalMinor: SignedDatabaseIntegerSchema,
    differenceMinor: SignedDatabaseIntegerSchema,
    kind: z.enum(['payment', 'refund']).optional(),
    internalType: OptionalText,
    internalId: OptionalText,
    statementLineId: OptionalText,
=======
    externalMinor: SignedDatabaseIntegerSchema,
    internalMinor: SignedDatabaseIntegerSchema,
    differenceMinor: SignedDatabaseIntegerSchema,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    state: z.string().min(1),
    reasonCode: OptionalText,
    evidence: z.record(z.string(), z.unknown()).optional().default({}),
    resolution: z.record(z.string(), z.unknown()).nullable().optional(),
    resolvedBy: OptionalText,
    approvedBy: OptionalText,
    preview: FinanceRepairPreviewSchema.optional(),
  })
  .passthrough();

const FinanceReconciliationRowPreviewSchema = z.object({
  source: z.literal('local-preview'),
  batchId: z.string().min(1),
  accountingDate: z.string().min(1),
  channelLabel: z.string().min(1),
  dataSourceLabel: z.string().min(1),
  scopeLabel: z.string().min(1),
  expectedCount: z.number().int().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  differenceCount: z.number().int().nonnegative(),
  paymentChannel: z.string().min(1),
  mall: z.string().min(1),
  differenceType: z.string().min(1),
  completedAt: z.string().min(1),
});

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
    preview: FinanceReconciliationRowPreviewSchema.optional(),
  })
  .passthrough();

const FinanceReconciliationPagePreviewSchema = z.object({
  source: z.literal('local-preview'),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  previousCursor: z.string().min(1).optional(),
  asOf: z.string().min(1),
  accountingDate: z.string().min(1),
  lastReconciledAt: z.string().min(1),
  pendingDifferenceCount: z.number().int().nonnegative(),
  pendingReviewCount: z.number().int().nonnegative(),
<<<<<<< HEAD
  facets: FinanceFacetsSchema,
=======
  facets: z.object({
    periods: z.array(FinancePreviewFacetSchema),
    channels: z.array(FinancePreviewFacetSchema),
    malls: z.array(FinancePreviewFacetSchema),
    statuses: z.array(FinancePreviewFacetSchema),
    differenceTypes: z.array(FinancePreviewFacetSchema),
  }),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
});

export const FinanceReconciliationPageSchema = z
  .object({
    items: z.array(FinanceReconciliationSchema).max(100),
    count: z.number().int().nonnegative(),
    nextCursor: z.string().min(1).optional(),
<<<<<<< HEAD
    facets: FinanceFacetsSchema.optional(),
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    preview: FinanceReconciliationPagePreviewSchema.optional(),
  })
  .superRefine((page, context) => {
    if (page.count !== page.items.length) context.addIssue({ code: 'custom', message: 'FINANCE_PAGE_COUNT_MISMATCH' });
    if (page.preview !== undefined && page.preview.total < page.count) {
      context.addIssue({ code: 'custom', message: 'FINANCE_PREVIEW_TOTAL_INVALID' });
    }
  });

export const FinanceFilterSchema = z.object({
  q: z.string().trim().max(200),
  period: z.string().trim().max(64),
  channel: z.string().trim().max(64),
  mall: z.string().trim().max(128),
  status: z.string().trim().max(64),
  difference: z.string().trim().max(64),
});

export const FinanceTabSchema = z.enum(['payments', 'refunds', 'rules', 'audit']);

export type FinanceFilter = z.infer<typeof FinanceFilterSchema>;
export type FinanceTab = z.infer<typeof FinanceTabSchema>;
export type FinanceReconciliation = z.infer<typeof FinanceReconciliationSchema>;
export type FinanceReconciliationItem = z.infer<typeof FinanceReconciliationItemSchema>;
export type FinanceReconciliationPage = z.infer<typeof FinanceReconciliationPageSchema>;
export type FinanceRepairPreview = z.infer<typeof FinanceRepairPreviewSchema>;
