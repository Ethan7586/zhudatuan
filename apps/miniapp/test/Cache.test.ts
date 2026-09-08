import { beforeEach, describe, expect, it } from 'vitest';
import { MiniappCache } from '../miniprogram/runtime/Cache';

const storage = new Map<string, unknown>();

beforeEach(() => {
  storage.clear();
  Object.assign(globalThis, { wx: {
    getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value), removeStorageSync: (key: string) => storage.delete(key),
  } });
});

describe('miniapp weak-network cache', () => {
  it('restores bounded public catalog data after a runtime restart', () => {
    const key = 'mall:one:catalog';
    new MiniappCache().write('miniappcatalog', key, { items: ['one'] }, 1_000);
    expect(new MiniappCache().read('miniappcatalog', key, 2_000)).toEqual({ items: ['one'] });
  });

  it('never persists private feature data and expires public entries', () => {
    const cache = new MiniappCache();
    cache.write('miniapporders', 'private', { order: 'secret' }, 1_000);
    expect(cache.read('miniapporders', 'private', 1_001)).toBeUndefined();
    cache.write('miniappcatalog', 'public', { item: 'one' }, 1_000);
    expect(cache.read('miniappcatalog', 'public', 1_000 + 301_000)).toBeUndefined();
  });
});
