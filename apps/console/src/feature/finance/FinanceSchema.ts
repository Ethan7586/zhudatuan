import { z } from 'zod';

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
const SignedDatabaseIntegerSchema = z
  .union([z.number().int(), z.string().regex(/^-?(?:0|[1-9][0-9]*)$/)])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .refine(Number.isSafeInteger, 'DATABASE_INTEGER_OUT_OF_RANGE');

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export const FinanceOverviewSchema = z.object({
  items: z.array(
    z.object({
      currency: z.string().min(3).max(3),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      balance_minor: SignedDatabaseIntegerSchema,
      liability_minor: SignedDatabaseIntegerSchema,
      income_minor: SignedDatabaseIntegerSchema,
      expense_minor: SignedDatabaseIntegerSchema,
      cash_minor: SignedDatabaseIntegerSchema,
<<<<<<< HEAD
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      balance_minor: z.number().finite(),
      liability_minor: z.number().finite(),
      income_minor: z.number().finite(),
      expense_minor: z.number().finite(),
      cash_minor: z.number().finite(),
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
