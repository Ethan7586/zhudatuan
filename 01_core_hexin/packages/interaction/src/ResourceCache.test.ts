import { describe, expect, it, vi } from 'vitest';
import { createResourceCache } from './ResourceCache';

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const cacheOptions = {
  namespace: 'test',
  schema: 'v1',
  validate: (value: unknown): value is readonly number[] => Array.isArray(value) && value.every(Number.isFinite),
};

describe('resource cache', () => {
  it('works without DOM or a persistence adapter', () => {
    const cache = createResourceCache(cacheOptions);
    expect(cache.read('missing')).toBeUndefined();
    cache.write('one', [1, 2]);
    expect(cache.read('one')).toEqual([1, 2]);
  });

  it('persists versioned values and ignores malformed records', () => {
    const storage = new MemoryStorage();
    const cache = createResourceCache(cacheOptions);
    cache.write('one', [1, 2], storage);
    const restored = createResourceCache(cacheOptions);
    expect(restored.read('one', storage)).toEqual([1, 2]);
    storage.setItem('test:broken', '{');
    expect(restored.read('broken', storage)).toBeUndefined();
  });

  it('deduplicates background revalidation for one resource', async () => {
    const cache = createResourceCache(cacheOptions);
    const loader = vi.fn(async () => [3, 4] as const);
    const first = cache.revalidate('one', loader);
    const second = cache.revalidate('one', loader);
    await expect(first).resolves.toEqual([3, 4]);
    await expect(second).resolves.toEqual([3, 4]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.read('one')).toEqual([3, 4]);
  });

  it('aborts active revalidation during disposal', async () => {
    const cache = createResourceCache(cacheOptions);
    const pending = cache.revalidate(
      'one',
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        })
    );
    cache.dispose();
    await expect(pending).rejects.toThrow('aborted');
  });
});
