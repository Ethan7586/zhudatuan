export async function mapParallel<T, R>(values: readonly T[], concurrency: number, operation: (value: T) => Promise<R>): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('PARALLEL_CONCURRENCY_INVALID');
  const result = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= values.length) return;
      result[index] = await operation(values[index]!);
    }
  }));
  return result;
}
