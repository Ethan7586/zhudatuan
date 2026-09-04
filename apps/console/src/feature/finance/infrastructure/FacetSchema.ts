import { z } from 'zod';

const item = z.object({ value: z.string(), label: z.string(), count: z.number().int().nonnegative() }).strict();
const group = z.object({ items: z.array(item), reason: z.string().nullable() }).strict();
const provider = item.extend({ available: z.boolean() }).strict();

export const FinanceFacetsSchema = z.object({
  periods: group,
  providers: z.object({ items: z.array(provider), reason: z.string().nullable() }).strict(),
  malls: group,
  states: group,
  differenceTypes: group,
  watermark: z.string().datetime().nullable(),
}).strict();
