import * as z from 'zod/mini';
import { exactOperationOutput } from '@shop/contract/schema';

export const AfterSalePageSchema = exactOperationOutput('OrderAftersalesReadOutput').check(
  z.refine((page) => page.items.length <= 50, { message: 'AFTERSALE_PAGE_LIMIT_EXCEEDED' }),
  z.refine((page) => page.count === page.items.length, { message: 'AFTERSALE_PAGE_COUNT_MISMATCH' })
);
