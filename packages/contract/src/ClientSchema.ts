import { z, type ZodType } from 'zod';

export interface ClientPage<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

export const transportInteger = z
  .union([z.number(), z.string().regex(/^-?\d+$/)])
  .transform((value) => Number(value))
  .pipe(z.number().int().safe());

export function parseClientPage<T>(value: unknown, itemSchema: ZodType<T>): ClientPage<T> {
  const envelope = z
    .object({
      items: z.array(itemSchema),
      nextCursor: z.string().min(1).optional(),
    })
    .passthrough();
  const result = envelope.parse(value);
  return { items: result.items, ...(result.nextCursor === undefined ? {} : { nextCursor: result.nextCursor }) };
}
