import { describe, expect, it } from 'vitest';
import { mapConcurrent } from './Parallel';

describe('mapConcurrent', () => {
  it('preserves input order while bounding active work', async () => {
    let active = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    const pending = mapConcurrent([1, 2, 3, 4, 5, 6], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => release.push(resolve));
      active -= 1;
      return value * 2;
    });
    await Promise.resolve();
    expect(active).toBe(2);
    while (release.length > 0) {
      release.shift()?.();
      await Promise.resolve();
    }
    await expect(pending).resolves.toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBe(2);
  });

  it('rejects invalid concurrency instead of silently running unbounded', async () => {
    await expect(mapConcurrent([1], 0, (value) => Promise.resolve(value))).rejects.toThrow('PARALLEL_MAXIMUM_INVALID');
  });
});
