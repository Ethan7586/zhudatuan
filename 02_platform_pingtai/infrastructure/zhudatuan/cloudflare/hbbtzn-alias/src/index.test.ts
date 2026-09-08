import { describe, expect, it, vi } from 'vitest';
import worker from './index';

describe('retired hbbtzn alias Worker', () => {
  it('fails closed without fetching, rewriting, redirecting, or selecting an upstream', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const response = await worker.fetch();
    expect(response.status).toBe(410);
    expect(response.headers.get('location')).toBeNull();
    await expect(response.json()).resolves.toEqual({ code: 'SFL_EDGE_ROUTE_RETIRED' });
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRestore();
  });
});
