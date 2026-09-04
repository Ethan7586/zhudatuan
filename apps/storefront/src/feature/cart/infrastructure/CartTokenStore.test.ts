import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartTokenStore } from './CartTokenStore';

describe('CartTokenStore', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates one 256-bit bearer and reuses it only inside its storefront key', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key) };
    const store = new CartTokenStore(storage, 'cart:mall-one');
    const first = store.current();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(store.current()).toBe(first);
    expect(values.get('cart:mall-one')).toBe(first);
  });

  it('removes the bearer after a completed login merge', () => {
    const values = new Map([['cart:mall-one', 'a'.repeat(43)]]);
    const store = new CartTokenStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value), removeItem: (key) => void values.delete(key) }, 'cart:mall-one');
    store.clear();
    expect(store.existing()).toBeNull();
  });
});
