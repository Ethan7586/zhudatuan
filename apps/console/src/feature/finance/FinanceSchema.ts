import { z } from 'zod';

export const FinanceOverviewSchema = z.object({
  items: z.array(
    z.object({
      currency: z.string().min(3).max(3),
      balance_minor: z.number().finite(),
      liability_minor: z.number().finite(),
      income_minor: z.number().finite(),
      expense_minor: z.number().finite(),
      cash_minor: z.number().finite(),
      journal_count: z.number().int().nonnegative(),
      watermark: z.string().nullable(),
    })
  ),
});

export type FinanceOverview = z.infer<typeof FinanceOverviewSchema>;
export type FinanceCurrency = FinanceOverview['items'][number];
