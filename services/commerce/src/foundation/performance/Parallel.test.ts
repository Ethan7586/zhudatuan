import { describe, expect, it, vi } from 'vitest';
import { mapParallel } from './Parallel';

describe('bounded parallel work', () => {
  it('keeps the concurrency bound and preserves input order', async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapParallel([3, 1, 2, 4, 5], 2, async value => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      return value * 2;
    });
    expect(result).toEqual([6, 2, 4, 8, 10]);
    expect(maximum).toBe(2);
    expect(active).toBe(0);
  });

  it('stops taking new rows after failure and drains active rows before rejecting', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const failure = new Error('KMS_UNAVAILABLE');
    const operation = vi.fn((value: number) => value === 0 ? first.promise : second.promise);
    let settled = false;
    const observed = mapParallel([0, 1, 2, 3], 2, operation).then(
      result => { settled = true; return result; }, cause => { settled = true; return cause; }
    );
    first.reject(failure);
    await Promise.resolve(); await Promise.resolve();
    expect(settled).toBe(false);
    expect(operation.mock.calls).toEqual([[0], [1]]);
    second.resolve(1);
    expect(await observed).toBe(failure);
    expect(operation.mock.calls).toEqual([[0], [1]]);
  });

  it('preserves the first error when multiple active operations fail', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const failure = new Error('DATABASE_UNAVAILABLE');
    const observed = mapParallel([0, 1, 2], 2, value => value === 0 ? first.promise : second.promise).catch(cause => cause);
    second.reject(failure);
    await Promise.resolve();
    first.reject(new Error('DEADLINE_EXCEEDED'));
    expect(await observed).toBe(failure);
  });

  it('does not confuse a thrown undefined value with successful completion', async () => {
    const operation = vi.fn(async () => { throw undefined; });
    const observed = await mapParallel([1, 2], 1, operation).then(() => ({ succeeded: true }), cause => ({ succeeded: false, cause }));
    expect(observed).toEqual({ succeeded: false, cause: undefined });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does no work for empty input and rejects invalid concurrency before scheduling', async () => {
    const operation = vi.fn(async (value: number) => value);
    expect(await mapParallel([], 2, operation)).toEqual([]);
    for (const concurrency of [0, -1, 0.1, NaN, Infinity]) await expect(mapParallel([1], concurrency, operation)).rejects.toThrow('PARALLEL_CONCURRENCY_INVALID');
    expect(operation).not.toHaveBeenCalled();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}
