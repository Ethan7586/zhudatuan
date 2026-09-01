import { z } from 'zod';

const SignedDatabaseIntegerSchema = z
  .union([z.number().int(), z.string().regex(/^-?(?:0|[1-9][0-9]*)$/)])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .refine(Number.isSafeInteger, 'DATABASE_INTEGER_OUT_OF_RANGE');

export const FinanceOverviewSchema = z.object({
  items: z.array(
    z.object({
      currency: z.string().min(3).max(3),
      balance_minor: SignedDatabaseIntegerSchema,
      liability_minor: SignedDatabaseIntegerSchema,
      income_minor: SignedDatabaseIntegerSchema,
      expense_minor: SignedDatabaseIntegerSchema,
      cash_minor: SignedDatabaseIntegerSchema,
      journal_count: z.number().int().nonnegative(),
      watermark: z.string().nullable(),
    })
  ),
  preview: z
    .object({
      source: z.literal('local-preview'),
      asOf: z.string().min(1),
      accountingDate: z.string().min(1),
      lastReconciledAt: z.string().min(1),
      pendingDifferenceCount: z.number().int().nonnegative(),
      pendingReviewCount: z.number().int().nonnegative(),
    })
    .optional(),
});

export type FinanceOverview = z.infer<typeof FinanceOverviewSchema>;
export type FinanceCurrency = FinanceOverview['items'][number];
export type FinanceOverviewPreview = NonNullable<FinanceOverview['preview']>;
