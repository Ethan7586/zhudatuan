export async function mapConcurrent<T, R>(values: readonly T[], maximum: number, execute: (value: T, index: number) => Promise<R>): Promise<readonly R[]> {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error('PARALLEL_MAXIMUM_INVALID');
  if (values.length === 0) return Object.freeze([]);
  const results = new Array<R>(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      const value = values[index];
      if (value !== undefined) results[index] = await execute(value, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(maximum, values.length) }, worker));
  return Object.freeze(results);
}
