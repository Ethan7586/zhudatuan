import * as z from 'zod/mini';

const wireInteger = z.union([
  z.int(),
  z.string().check(z.regex(/^(?:0|[1-9][0-9]*)$/)),
]);

export const DatabaseIntegerSchema = z.pipe(
  wireInteger,
  z.pipe(
    z.transform<string | number, number>((value) => typeof value === 'number' ? value : Number(value)),
    z.int().check(z.nonnegative(), z.maximum(Number.MAX_SAFE_INTEGER)),
  ),
);
