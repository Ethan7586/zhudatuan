import { describe, expect, it, vi } from 'vitest';
import { createStorefrontQueryClient } from './QueryRuntime';

describe('storefront query runtime', () => {
  it('deduplicates concurrent reads and supports explicit invalidation', async () => {
    const client = createStorefrontQueryClient();
    const query = vi.fn(() => Promise.resolve({ id: 'listing:one' }));
    const options = { queryKey: ['storefront', 'mall:one', 'catalog'] as const, queryFn: query };
    const [left, right] = await Promise.all([client.fetchQuery(options), client.fetchQuery(options)]);
    expect(left).toEqual(right);
    expect(query).toHaveBeenCalledTimes(1);
    await client.invalidateQueries({ queryKey: options.queryKey });
    expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
    client.clear();
  });

  it('retries reads once and never retries writes automatically', () => {
    const defaults = createStorefrontQueryClient().getDefaultOptions();
    expect(defaults.queries).toMatchObject({ retry: 1, staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: false, refetchOnReconnect: true });
    expect(defaults.mutations).toMatchObject({ retry: false });
  });

  it('recovers a weak-network read once without duplicating a write', async () => {
    const client = createStorefrontQueryClient();
    const query = vi.fn()
      .mockRejectedValueOnce(new TypeError('network interrupted'))
      .mockResolvedValueOnce({ items: ['listing:one'] });

    await expect(client.fetchQuery({ queryKey: ['storefront', 'public', 'catalog'], queryFn: query, retryDelay: 0 })).resolves.toEqual({ items: ['listing:one'] });
    expect(query).toHaveBeenCalledTimes(2);
    client.clear();
  });
});
