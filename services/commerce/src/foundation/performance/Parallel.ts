import { Deadline } from './Deadline';

export async function mapParallel<T, R>(values: readonly T[], concurrency: number, operation: (value: T) => Promise<R>): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('PARALLEL_CONCURRENCY_INVALID');
  const result = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      for (;;) {
        const index = cursor++;
        if (index >= values.length) return;
        result[index] = await operation(values[index]!);
      }
    })
  );
  return result;
}

export async function allParallel<const T extends readonly (() => Promise<unknown>)[]>(
  tasks: T,
  options: Readonly<{ concurrency: number; expiresAt: number; signal: AbortSignal }>
): Promise<{
  readonly [K in keyof T]: Awaited<ReturnType<T[K]>>;
}> {
  const deadline = Deadline.at(options.expiresAt, options.signal);
  try {
    const results = await mapParallel(tasks, options.concurrency, async (task) => {
      deadline.throwIfExpired();
      const result = await task();
      deadline.throwIfExpired();
      return result;
    });
    return results as { readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
  } finally {
    deadline.dispose();
  }
}
