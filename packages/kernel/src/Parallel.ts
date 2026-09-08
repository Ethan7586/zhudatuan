import { Deadline } from './deadline';

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

export async function mapParallel<T, R>(values: readonly T[], concurrency: number, operation: (value: T) => Promise<R>): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('PARALLEL_CONCURRENCY_INVALID');
  const result = new Array<R>(values.length);
  let cursor = 0;
  let failed = false;
  let failure: unknown;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (!failed) {
        const index = cursor++;
        if (index >= values.length) return;
        try {
          result[index] = await operation(values[index]!);
        } catch (cause) {
          if (!failed) {
            failed = true;
            failure = cause;
          }
        }
      }
    })
  );
  if (failed) throw failure;
  return result;
}

export async function allParallel<const T extends readonly (() => Promise<unknown>)[]>(
  tasks: T,
  options: Readonly<{ concurrency: number; expiresAt: number; signal: AbortSignal }>
): Promise<{ readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
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
