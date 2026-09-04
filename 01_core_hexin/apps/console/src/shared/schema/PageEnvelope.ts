import { z } from 'zod';

export function pageEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    count: z.number().int().nonnegative(),
    nextCursor: z.string().min(1).optional(),
  });
}
