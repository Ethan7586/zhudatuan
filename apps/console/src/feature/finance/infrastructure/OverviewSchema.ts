import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../../shared/schema/DatabaseInteger';

export const FinanceOverviewSchema = z.object({
  items: z.array(
    z.object({
      currency: z.string().min(3).max(3),
      balance_minor: DatabaseIntegerSchema,
      liability_minor: DatabaseIntegerSchema,
      income_minor: DatabaseIntegerSchema,
      expense_minor: DatabaseIntegerSchema,
      cash_minor: DatabaseIntegerSchema,
      journal_count: DatabaseIntegerSchema,
      watermark: z.string().nullable(),
    })
  ),
});
